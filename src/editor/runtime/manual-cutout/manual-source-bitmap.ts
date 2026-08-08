export async function loadManualSourceBitmap(sourceUrl: string): Promise<ImageBitmap> {
  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Manual source preview is unavailable"));
    image.src = sourceUrl;
  });
  return createImageBitmap(image);
}
