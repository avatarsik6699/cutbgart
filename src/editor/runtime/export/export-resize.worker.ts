type ResizeCommand = Readonly<{
  blob: Blob;
  height: number;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  type: "RESIZE_EXPORT";
  width: number;
}>;

type ResizeEvent =
  | Readonly<{ blob: Blob; type: "RESIZED" }>
  | Readonly<{ message: string; type: "FAILED" }>;

const scope = globalThis as unknown as {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<ResizeCommand>) => void,
  ): void;
  postMessage(event: ResizeEvent): void;
};

scope.addEventListener("message", (event) => {
  if (event.data.type !== "RESIZE_EXPORT") return;
  void (async () => {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(event.data.blob);
      const canvas = new OffscreenCanvas(event.data.width, event.data.height);
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("PNG export is unavailable");
      context.drawImage(bitmap, 0, 0, event.data.width, event.data.height);
      const blob = await canvas.convertToBlob({ type: event.data.mediaType });
      scope.postMessage({ type: "RESIZED", blob });
    } catch (error) {
      scope.postMessage({
        type: "FAILED",
        message: error instanceof Error ? error.message : "PNG export failed",
      });
    } finally {
      bitmap?.close();
    }
  })();
});
