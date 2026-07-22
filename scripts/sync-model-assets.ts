/**
 * Synchronizes the pinned model and ONNX Runtime Web assets declared in
 * models.manifest.json into the host directory mounted read-only by Nginx.
 */
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, "deploy", "model-assets");

export interface ManifestModel {
  id: string;
  revision: string;
  files: string[];
}

export interface ModelManifest {
  models: ManifestModel[];
  onnxRuntimeWeb: { version: string; files: string[] };
}

export interface RemoteAsset {
  source: string;
  relativePath: string;
}

export function buildModelAssetPlan(manifest: ModelManifest): RemoteAsset[] {
  return manifest.models.flatMap((model) =>
    model.files.map((file) => ({
      source: `https://huggingface.co/${model.id}/resolve/${model.revision}/${file}`,
      relativePath: path.posix.join(model.id, "resolve", model.revision, file),
    })),
  );
}

export function buildOnnxRuntimeAssetPlan(manifest: ModelManifest): RemoteAsset[] {
  const { version, files } = manifest.onnxRuntimeWeb;
  return files.map((file) => ({
    source: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${version}/dist/${file}`,
    relativePath: path.posix.join("onnxruntime-web", version, file),
  }));
}

export function validateManifest(manifest: ModelManifest, ortVersion: string): void {
  const requirements = new Map<string, string[]>([
    [
      "onnx-community/ISNet-ONNX",
      [
        "config.json",
        "preprocessor_config.json",
        "onnx/model_quantized.onnx",
        "onnx/model.onnx",
      ],
    ],
    [
      "onnx-community/BEN2-ONNX",
      ["config.json", "preprocessor_config.json", "onnx/model_fp16.onnx"],
    ],
    [
      "Xenova/slimsam-77-uniform",
      [
        "config.json",
        "preprocessor_config.json",
        "onnx/vision_encoder_quantized.onnx",
        "onnx/prompt_encoder_mask_decoder_quantized.onnx",
      ],
    ],
    [
      "Xenova/vitmatte-small-distinctions-646",
      [
        "config.json",
        "preprocessor_config.json",
        "onnx/model_quantized.onnx",
        "onnx/model.onnx",
      ],
    ],
  ]);
  for (const [id, files] of requirements) {
    const model = manifest.models.find((candidate) => candidate.id === id);
    if (!model) throw new Error(`models.manifest.json does not declare ${id}`);
    if (!/^[0-9a-f]{40}$/.test(model.revision)) {
      throw new Error(`${id} revision must be an immutable 40-character Git SHA`);
    }
    for (const required of files) {
      if (!model.files.includes(required)) {
        throw new Error(`${id} is missing required file: ${required}`);
      }
    }
  }
  if (manifest.onnxRuntimeWeb.version !== ortVersion) {
    throw new Error(
      `Manifest ONNX Runtime Web ${manifest.onnxRuntimeWeb.version} does not match package.json ${ortVersion}`,
    );
  }
  const requiredRuntimeFiles = [
    "ort-wasm-simd-threaded.asyncify.mjs",
    "ort-wasm-simd-threaded.asyncify.wasm",
    "ort-wasm-simd-threaded.jsep.mjs",
    "ort-wasm-simd-threaded.jsep.wasm",
    "ort-wasm-simd-threaded.jspi.mjs",
    "ort-wasm-simd-threaded.jspi.wasm",
    "ort-wasm-simd-threaded.mjs",
    "ort-wasm-simd-threaded.wasm",
  ];
  for (const required of requiredRuntimeFiles) {
    if (!manifest.onnxRuntimeWeb.files.includes(required)) {
      throw new Error(`Manifest is missing ONNX Runtime Web file: ${required}`);
    }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function downloadAsset(
  asset: RemoteAsset,
  outputDir: string,
  force: boolean,
): Promise<void> {
  const target = path.join(outputDir, ...asset.relativePath.split("/"));
  if (!force && (await fileExists(target))) {
    console.log(`skip (exists): ${asset.relativePath}`);
    return;
  }

  const response = await fetch(asset.source);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${asset.source}: ${String(response.status)} ${response.statusText}`,
    );
  }

  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${String(process.pid)}`;
  try {
    await writeFile(temporary, Buffer.from(await response.arrayBuffer()));
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  console.log(`synced: ${asset.relativePath}`);
}

async function loadInputs(): Promise<{
  manifest: ModelManifest;
  ortVersion: string;
}> {
  const [manifestRaw, packageRaw] = await Promise.all([
    readFile(path.join(REPO_ROOT, "models.manifest.json"), "utf8"),
    readFile(path.join(REPO_ROOT, "package.json"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestRaw) as ModelManifest;
  const packageJson = JSON.parse(packageRaw) as {
    dependencies?: Record<string, string>;
  };
  const ortVersion = packageJson.dependencies?.["onnxruntime-web"]?.replace(
    /^[^0-9]*/,
    "",
  );
  if (!ortVersion) throw new Error("package.json does not declare onnxruntime-web");
  return { manifest, ortVersion };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const { manifest, ortVersion } = await loadInputs();
  validateManifest(manifest, ortVersion);

  if (args.includes("--check")) {
    console.log("models.manifest.json is valid");
    return;
  }

  const outputArg = args.find((arg) => arg.startsWith("--output="));
  const outputDir = outputArg
    ? path.resolve(outputArg.slice("--output=".length))
    : DEFAULT_OUTPUT_DIR;
  const force = args.includes("--force");
  await mkdir(outputDir, { recursive: true });
  for (const asset of buildModelAssetPlan(manifest)) {
    await downloadAsset(asset, outputDir, force);
  }
  for (const asset of buildOnnxRuntimeAssetPlan(manifest)) {
    await downloadAsset(asset, outputDir, force);
  }
  console.log(`Model assets are ready in ${outputDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
