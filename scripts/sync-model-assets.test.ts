import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildAssetPlan,
  validateManifest,
  verifyAssetFile,
  type ModelAssetManifest,
} from "./sync-model-assets";

const tempDirectories: string[] = [];
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const manifest: ModelAssetManifest = {
  schemaVersion: 1,
  release: "v0.22.0",
  assets: [
    {
      path: "onnx-community/ISNet-ONNX/resolve/3fe6e3db3e32c69aadde61fe388ddb1a0574440c/config.json",
      revision: "3fe6e3db3e32c69aadde61fe388ddb1a0574440c",
      byteSize: 2,
      sha256: sha256("{}"),
    },
    {
      path: "onnxruntime-web/1.27.0/ort-wasm-simd-threaded.wasm",
      revision: "npm:onnxruntime-web@1.27.0",
      byteSize: 4,
      sha256: sha256("wasm"),
    },
  ],
};

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("model asset manifest", () => {
  it("maps immutable model and runtime paths to pinned upstream sources", () => {
    validateManifest(manifest, "1.27.0");
    expect(buildAssetPlan(manifest).map(({ source }) => source)).toEqual([
      "https://huggingface.co/onnx-community/ISNet-ONNX/resolve/3fe6e3db3e32c69aadde61fe388ddb1a0574440c/config.json",
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/ort-wasm-simd-threaded.wasm",
    ]);
  });

  it("rejects mutable, duplicate, traversing, or malformed records", () => {
    const mutable = structuredClone(manifest);
    mutable.assets[0]!.revision = "main";
    expect(() => validateManifest(mutable, "1.27.0")).toThrow(/revision/);

    const duplicate = structuredClone(manifest);
    duplicate.assets.push({ ...duplicate.assets[0]! });
    expect(() => validateManifest(duplicate, "1.27.0")).toThrow(/Duplicate/);

    const traversal = structuredClone(manifest);
    traversal.assets[0]!.path = "../escape.onnx";
    expect(() => validateManifest(traversal, "1.27.0")).toThrow(/Unsafe/);

    const badHash = structuredClone(manifest);
    badHash.assets[0]!.sha256 = "not-a-digest";
    expect(() => validateManifest(badHash, "1.27.0")).toThrow(/sha256/);
  });

  it("detects cached size and same-size content corruption", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "cutbg-model-test-"));
    tempDirectories.push(directory);
    const filePath = path.join(directory, "asset");
    const asset = {
      path: "asset",
      revision: "test",
      byteSize: 4,
      sha256: sha256("good"),
    };

    await writeFile(filePath, "good");
    expect(await verifyAssetFile(filePath, asset)).toBe(true);
    await writeFile(filePath, "evil");
    expect(await verifyAssetFile(filePath, asset)).toBe(false);
    await writeFile(filePath, "shorter");
    expect(await verifyAssetFile(filePath, asset)).toBe(false);
  });

  it("keeps the browser manifest contract in sync with the operator manifest", async () => {
    const [operatorRaw, browserRaw] = await Promise.all([
      readFile(path.resolve("models.manifest.json"), "utf8"),
      readFile(path.resolve("public/models.manifest.json"), "utf8"),
    ]);
    const operator = JSON.parse(operatorRaw) as ModelAssetManifest;
    const browser = JSON.parse(browserRaw) as ModelAssetManifest;
    expect({
      schemaVersion: browser.schemaVersion,
      release: browser.release,
      assets: browser.assets,
    }).toEqual({
      schemaVersion: operator.schemaVersion,
      release: operator.release,
      assets: operator.assets,
    });
    expect(operator.assets.length).toBeGreaterThan(20);
  });
});
