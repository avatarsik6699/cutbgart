export type ExportFormat = "png";
export type ExportSize = "original" | 2048 | 1024;

export interface ExportSettings {
  format: ExportFormat;
  longestSide: ExportSize;
}

export const DEFAULT_EXPORT_SETTINGS: Readonly<ExportSettings> = Object.freeze({
  format: "png",
  longestSide: "original",
});
