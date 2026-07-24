/**
 * Atomically synchronizes and verifies every immutable model/WASM asset in
 * models.manifest.json. The previous complete release stays beside the active
 * directory for an operator-controlled rollback.
 */
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT_DIR = process.env.MODEL_ASSET_OUTPUT_DIR
  ? path.resolve(process.env.MODEL_ASSET_OUTPUT_DIR)
  : path.join(REPO_ROOT, "deploy", "model-assets");
const RELEASE_MARKER = ".model-assets-manifest.json";

export interface VerifiedModelAsset {
  path: string;
  revision: string;
  byteSize: number;
  sha256: string;
}

export interface ModelAssetManifest {
  schemaVersion: 1;
  release: string;
  assets: VerifiedModelAsset[];
}

export interface RemoteAsset extends VerifiedModelAsset {
  source: string;
}

function parseJsonManifest(raw: string): ModelAssetManifest {
  return JSON.parse(raw) as ModelAssetManifest;
}

export function buildAssetPlan(manifest: ModelAssetManifest): RemoteAsset[] {
  return manifest.assets.map((asset) => {
    if (asset.path.startsWith("onnxruntime-web/")) {
      const match = /^onnxruntime-web\/([^/]+)\/(.+)$/.exec(asset.path);
      if (!match || asset.revision !== `npm:onnxruntime-web@${match[1]}`) {
        throw new Error(`Invalid ONNX Runtime path/revision: ${asset.path}`);
      }
      return {
        ...asset,
        source: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${match[1]}/dist/${match[2]}`,
      };
    }

    const revisionSegment = `/resolve/${asset.revision}/`;
    if (!asset.path.includes(revisionSegment)) {
      throw new Error(
        `Asset path does not contain its immutable revision: ${asset.path}`,
      );
    }
    return { ...asset, source: `https://huggingface.co/${asset.path}` };
  });
}

export function validateManifest(manifest: ModelAssetManifest, ortVersion: string): void {
  if (manifest.schemaVersion !== 1) {
    throw new Error("models.manifest.json schemaVersion must be 1");
  }
  if (!/^v\d+\.\d+\.\d+$/.test(manifest.release)) {
    throw new Error("models.manifest.json release must be an immutable vX.Y.Z label");
  }
  if (!manifest.assets.length)
    throw new Error("Manifest must declare at least one asset");

  const paths = new Set<string>();
  for (const asset of manifest.assets) {
    if (
      !asset.path ||
      path.posix.isAbsolute(asset.path) ||
      asset.path.split("/").includes("..")
    ) {
      throw new Error(`Unsafe asset path: ${asset.path}`);
    }
    if (paths.has(asset.path)) throw new Error(`Duplicate asset path: ${asset.path}`);
    paths.add(asset.path);
    if (!Number.isSafeInteger(asset.byteSize) || asset.byteSize <= 0) {
      throw new Error(`Invalid byteSize for ${asset.path}`);
    }
    if (!/^[0-9a-f]{64}$/.test(asset.sha256)) {
      throw new Error(`Invalid sha256 for ${asset.path}`);
    }
  }

  const ortAssets = manifest.assets.filter((asset) =>
    asset.path.startsWith("onnxruntime-web/"),
  );
  if (
    !ortAssets.length ||
    ortAssets.some(
      (asset) =>
        !asset.path.startsWith(`onnxruntime-web/${ortVersion}/`) ||
        asset.revision !== `npm:onnxruntime-web@${ortVersion}`,
    )
  ) {
    throw new Error(`Manifest ONNX Runtime assets must match package.json ${ortVersion}`);
  }
  buildAssetPlan(manifest);
}

async function digestFile(
  filePath: string,
): Promise<{ byteSize: number; sha256: string }> {
  const handle = await open(filePath, "r");
  const hash = createHash("sha256");
  let byteSize = 0;
  try {
    for await (const chunk of handle.readableWebStream()) {
      const bytes = new Uint8Array(chunk);
      byteSize += bytes.byteLength;
      hash.update(bytes);
    }
  } finally {
    await handle.close();
  }
  return { byteSize, sha256: hash.digest("hex") };
}

export async function verifyAssetFile(
  filePath: string,
  asset: VerifiedModelAsset,
): Promise<boolean> {
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile() || metadata.size !== asset.byteSize) return false;
    const digest = await digestFile(filePath);
    return digest.byteSize === asset.byteSize && digest.sha256 === asset.sha256;
  } catch {
    return false;
  }
}

async function downloadVerifiedAsset(asset: RemoteAsset, target: string): Promise<void> {
  const response = await fetch(asset.source, {
    headers: { "accept-encoding": "identity" },
    signal: AbortSignal.timeout(15 * 60_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(
      `Failed to fetch ${asset.source}: ${String(response.status)} ${response.statusText}`,
    );
  }

  await mkdir(path.dirname(target), { recursive: true });
  const handle = await open(target, "wx");
  const hash = createHash("sha256");
  let byteSize = 0;
  try {
    const writer = handle.createWriteStream();
    for await (const chunk of response.body) {
      const bytes = new Uint8Array(chunk);
      byteSize += bytes.byteLength;
      hash.update(bytes);
      if (!writer.write(bytes)) {
        await new Promise<void>((resolve) => writer.once("drain", resolve));
      }
    }
    await new Promise<void>((resolve, reject) => {
      writer.end(resolve);
      writer.once("error", reject);
    });
  } finally {
    await handle.close().catch(() => undefined);
  }

  const sha256 = hash.digest("hex");
  if (byteSize !== asset.byteSize || sha256 !== asset.sha256) {
    await rm(target, { force: true });
    throw new Error(
      `Integrity check failed for ${asset.path}: got ${String(byteSize)} bytes / ${sha256}`,
    );
  }
}

async function verifyReleaseDirectory(
  directory: string,
  manifest: ModelAssetManifest,
): Promise<void> {
  for (const asset of manifest.assets) {
    if (!(await verifyAssetFile(path.join(directory, ...asset.path.split("/")), asset))) {
      throw new Error(`Missing or corrupt asset: ${asset.path}`);
    }
  }
}

async function loadInputs(): Promise<{
  manifest: ModelAssetManifest;
  manifestRaw: string;
  ortVersion: string;
}> {
  const [manifestRaw, publicManifestRaw, packageRaw] = await Promise.all([
    readFile(path.join(REPO_ROOT, "models.manifest.json"), "utf8"),
    readFile(path.join(REPO_ROOT, "public", "models.manifest.json"), "utf8"),
    readFile(path.join(REPO_ROOT, "package.json"), "utf8"),
  ]);
  const manifest = parseJsonManifest(manifestRaw);
  const publicManifest = parseJsonManifest(publicManifestRaw);
  if (
    JSON.stringify({
      schemaVersion: manifest.schemaVersion,
      release: manifest.release,
      assets: manifest.assets,
    }) !==
    JSON.stringify({
      schemaVersion: publicManifest.schemaVersion,
      release: publicManifest.release,
      assets: publicManifest.assets,
    })
  ) {
    throw new Error("public/models.manifest.json is out of sync");
  }
  const packageJson = JSON.parse(packageRaw) as {
    dependencies?: Record<string, string>;
  };
  const ortVersion = packageJson.dependencies?.["onnxruntime-web"]?.replace(
    /^[^0-9]*/,
    "",
  );
  if (!ortVersion) throw new Error("package.json does not declare onnxruntime-web");
  return { manifest, manifestRaw, ortVersion };
}

async function rollback(outputDir: string): Promise<void> {
  const previousDir = `${outputDir}.previous`;
  const previousRaw = await readFile(path.join(previousDir, RELEASE_MARKER), "utf8");
  const previousManifest = parseJsonManifest(previousRaw);
  await verifyReleaseDirectory(previousDir, previousManifest);

  const displaced = `${outputDir}.rollback-${String(process.pid)}`;
  await rename(outputDir, displaced);
  try {
    await rename(previousDir, outputDir);
    await rename(displaced, previousDir);
  } catch (error) {
    await rename(displaced, outputDir).catch(() => undefined);
    throw error;
  }
  console.log(`Rolled back model assets to ${previousManifest.release}`);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const { manifest, manifestRaw, ortVersion } = await loadInputs();
  validateManifest(manifest, ortVersion);

  const outputArg = args.find((arg) => arg.startsWith("--output="));
  const outputDir = outputArg
    ? path.resolve(outputArg.slice("--output=".length))
    : DEFAULT_OUTPUT_DIR;
  if (args.includes("--check")) {
    console.log(`models.manifest.json ${manifest.release} is valid`);
    return;
  }
  if (args.includes("--verify-cache")) {
    await verifyReleaseDirectory(outputDir, manifest);
    console.log(`Verified ${manifest.assets.length} cached assets`);
    return;
  }
  if (args.includes("--rollback")) {
    await rollback(outputDir);
    return;
  }

  const stagingDir = `${outputDir}.staging-${String(process.pid)}`;
  const previousDir = `${outputDir}.previous`;
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  try {
    for (const asset of buildAssetPlan(manifest)) {
      const current = path.join(outputDir, ...asset.path.split("/"));
      const target = path.join(stagingDir, ...asset.path.split("/"));
      await mkdir(path.dirname(target), { recursive: true });
      if (await verifyAssetFile(current, asset)) {
        await copyFile(current, target);
        console.log(`verified cached: ${asset.path}`);
      } else {
        await downloadVerifiedAsset(asset, target);
        console.log(`downloaded and verified: ${asset.path}`);
      }
    }
    await writeFile(path.join(stagingDir, RELEASE_MARKER), manifestRaw);
    await verifyReleaseDirectory(stagingDir, manifest);

    await rm(previousDir, { recursive: true, force: true });
    let movedCurrent = false;
    try {
      await rename(outputDir, previousDir);
      movedCurrent = true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }
    try {
      await rename(stagingDir, outputDir);
    } catch (error) {
      if (movedCurrent) await rename(previousDir, outputDir).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true });
    throw error;
  }
  console.log(`Activated ${manifest.release}; previous release retained for rollback`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
