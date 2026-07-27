export function sourcePixelsToViewportPixels(
  sourcePixels: number,
  renderedSourceWidth: number,
  sourceWidth: number,
): number {
  if (sourceWidth <= 0 || renderedSourceWidth <= 0) return 0;
  return sourcePixels * (renderedSourceWidth / sourceWidth);
}
