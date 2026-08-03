export function applyMatte(source: ImageData, matte: Uint8ClampedArray): void {
  if (matte.length !== source.width * source.height) {
    throw new Error("Segmentation matte dimensions do not match the decoded source");
  }
  for (let pixel = 0; pixel < matte.length; pixel += 1) {
    source.data[pixel * 4 + 3] = matte[pixel] ?? 0;
  }
}
