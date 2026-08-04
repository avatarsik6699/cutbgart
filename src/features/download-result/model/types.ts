export type ExportFormat = "png";
export type { ExportSize } from "@/entities/processed-image";
import type { ExportSize } from "@/entities/processed-image";

export type ExportSettings = {
  format: ExportFormat;
  longestSide: ExportSize;
};

export const DEFAULT_EXPORT_SETTINGS: Readonly<ExportSettings> = Object.freeze({
  format: "png",
  longestSide: "original",
});
