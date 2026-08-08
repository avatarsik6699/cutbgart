import type { ModelCacheAsset } from "./model-cache";

export type ModelCacheGroupId = "fast" | "optimal" | "maximum" | "enhancements" | "magic";

export type ModelCacheGroup = Readonly<{
  id: ModelCacheGroupId;
  assetCount: number;
  byteSize: number;
}>;

export type ModelCacheGroups = Readonly<{
  models: readonly ModelCacheGroup[];
  runtime: Readonly<{
    assetCount: number;
    byteSize: number;
    version: string | null;
  }> | null;
}>;

const MODEL_GROUP_ORDER: readonly ModelCacheGroupId[] = [
  "fast",
  "optimal",
  "maximum",
  "enhancements",
  "magic",
];

function modelGroupId(path: string): ModelCacheGroupId | null {
  if (path.includes("/ISNet-ONNX/") && path.endsWith("/model_quantized.onnx")) {
    return "fast";
  }
  if (path.includes("/ISNet-ONNX/") && path.endsWith("/model.onnx")) {
    return "optimal";
  }
  if (path.includes("/BEN2-ONNX/")) return "maximum";
  if (path.includes("/vitmatte-small-distinctions-646/")) return "enhancements";
  if (path.includes("/slimsam-77-uniform/")) return "magic";
  return null;
}

export function groupModelCacheAssets(
  assets: readonly ModelCacheAsset[],
): ModelCacheGroups {
  const groups = new Map<ModelCacheGroupId, { assetCount: number; byteSize: number }>();
  let runtimeAssetCount = 0;
  let runtimeByteSize = 0;
  let runtimeVersion: string | null = null;

  for (const asset of assets) {
    if (asset.path.startsWith("onnxruntime-web/")) {
      runtimeAssetCount += 1;
      runtimeByteSize += asset.byteSize;
      runtimeVersion ??= /^npm:onnxruntime-web@(.+)$/.exec(asset.revision)?.[1] ?? null;
      continue;
    }

    const id = modelGroupId(asset.path);
    if (id === null) continue;
    const current = groups.get(id) ?? { assetCount: 0, byteSize: 0 };
    current.assetCount += 1;
    current.byteSize += asset.byteSize;
    groups.set(id, current);
  }

  return {
    models: MODEL_GROUP_ORDER.flatMap((id) => {
      const group = groups.get(id);
      return group ? [{ id, ...group }] : [];
    }),
    runtime:
      runtimeAssetCount > 0
        ? {
            assetCount: runtimeAssetCount,
            byteSize: runtimeByteSize,
            version: runtimeVersion,
          }
        : null,
  };
}
