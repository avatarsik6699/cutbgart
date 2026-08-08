import type { ExportSize } from "@/editor/domain";

export type ExportDimensions = Readonly<{ width: number; height: number }>;

export function selectedExportDimensions(
  source: ExportDimensions,
  size: ExportSize,
): ExportDimensions {
  const longest = Math.max(source.width, source.height);
  if (size === "original" || size >= longest) return source;
  const scale = size / longest;
  return source.width >= source.height
    ? { width: size, height: Math.max(1, Math.round(source.height * scale)) }
    : { width: Math.max(1, Math.round(source.width * scale)), height: size };
}

export function exportFileName(size: ExportSize): string {
  return size === "original" ? "cutbg-result.png" : `cutbg-result-${String(size)}.png`;
}
