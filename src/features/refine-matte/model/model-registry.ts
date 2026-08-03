import type { InferencePath } from "../../../entities/processed-image";
import { formatMegabytes, getMattingModel, MATTING_MODELS } from "@/shared/lib";
import type { MattingRefinementMode } from "./types";

export { getMattingModel, MATTING_MODELS };

export function recommendMattingMode(path: InferencePath | null): MattingRefinementMode {
  return path === "webgpu" ? "maximum" : "balanced";
}

export function formatMattingModelSize(bytes: number): string {
  return formatMegabytes(bytes, {
    decimals: bytes < 50_000_000 ? 1 : 0,
    unitLabel: "MB",
  });
}
