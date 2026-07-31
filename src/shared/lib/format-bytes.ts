// Two distinct byte-formatting shapes were duplicated across
// features/refine-matte, features/model-lab, and features/model-storage
// (PHASE_31 F-22) — consolidated here with each call site's exact prior
// output preserved via explicit options, not silently changed.

export function formatMegabytes(
  bytes: number,
  options: { decimals: number; unitLabel: string },
): string {
  return `${(bytes / 1_000_000).toFixed(options.decimals)} ${options.unitLabel}`;
}

export function formatBytesLadder(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
