/**
 * Mirrors the model weights + ONNX Runtime Web WASM binaries declared in
 * models.manifest.json to Cloudflare R2 (SPEC.md §6). Runs from
 * .github/workflows/upload-model-weights.yml — triggered when
 * models.manifest.json changes, or manually via workflow_dispatch.
 *
 * The R2 object keys mirror the exact path Transformers.js requests at
 * runtime (`env.remoteHost` + its default `{model}/resolve/{revision}/`
 * template, and `env.backends.onnx.wasm.wasmPaths`), so no custom path
 * scheme needs to be kept in sync between this script and
 * src/features/remove-background/worker/inference.worker.ts.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CACHE_CONTROL = "public, max-age=31536000, immutable";

interface ManifestModel {
  role: string;
  id: string;
  revision: string;
  files: string[];
}

interface Manifest {
  models: ManifestModel[];
  onnxRuntimeWeb: { version: string };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath);
  switch (ext) {
    case ".onnx":
      return "application/octet-stream";
    case ".json":
      return "application/json";
    case ".wasm":
      return "application/wasm";
    case ".mjs":
    case ".js":
      return "text/javascript";
    default:
      return "application/octet-stream";
  }
}

async function objectExists(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadIfMissing(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  force: boolean,
): Promise<void> {
  if (!force && (await objectExists(client, bucket, key))) {
    console.log(`skip (exists): ${key}`);
    return;
  }
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentTypeFor(key),
      CacheControl: CACHE_CONTROL,
    }),
  );
  console.log(`uploaded: ${key} (${String(body.byteLength)} bytes)`);
}

async function fetchModelFile(
  modelId: string,
  revision: string,
  file: string,
): Promise<Buffer> {
  const url = `https://huggingface.co/${modelId}/resolve/${revision}/${file}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${String(response.status)} ${response.statusText}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

async function syncModels(
  client: S3Client,
  bucket: string,
  manifest: Manifest,
  force: boolean,
): Promise<void> {
  for (const model of manifest.models) {
    console.log(`\n== ${model.role}: ${model.id}@${model.revision} ==`);
    for (const file of model.files) {
      const body = await fetchModelFile(model.id, model.revision, file);
      const key = `${model.id}/resolve/${model.revision}/${file}`;
      await uploadIfMissing(client, bucket, key, body, force);
    }
  }
}

async function syncOnnxRuntimeWeb(
  client: S3Client,
  bucket: string,
  manifest: Manifest,
  force: boolean,
): Promise<void> {
  const { version } = manifest.onnxRuntimeWeb;
  const distDir = path.join(REPO_ROOT, "node_modules", "onnxruntime-web", "dist");
  console.log(`\n== onnxruntime-web@${version} (${distDir}) ==`);

  const entries = await readdir(distDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const body = await readFile(path.join(distDir, entry.name));
    const key = `onnxruntime-web/${version}/${entry.name}`;
    await uploadIfMissing(client, bucket, key, body, force);
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");

  const manifestRaw = await readFile(
    path.join(REPO_ROOT, "models.manifest.json"),
    "utf-8",
  );
  const manifest = JSON.parse(manifestRaw) as Manifest;

  const accountId = requireEnv("R2_ACCOUNT_ID");
  const bucket = requireEnv("R2_BUCKET_NAME");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  await syncModels(client, bucket, manifest, force);
  await syncOnnxRuntimeWeb(client, bucket, manifest, force);

  console.log("\nDone.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
