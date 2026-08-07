import {
  BACKGROUND_IMAGE_MAX_DIMENSION,
  BACKGROUND_IMAGE_PROTOCOL_VERSION,
  type BackgroundImageWorkerCommand,
  type BackgroundImageWorkerEvent,
} from "../background-image-protocol";

type WorkerScope = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<BackgroundImageWorkerCommand>) => void,
  ): void;
  postMessage(message: BackgroundImageWorkerEvent, transfer?: Transferable[]): void;
};

const scope = globalThis as unknown as WorkerScope;

async function prepare(command: BackgroundImageWorkerCommand): Promise<void> {
  let bitmap: ImageBitmap | null = null;
  try {
    const source = new Blob([command.bytes], { type: command.mediaType });
    bitmap = await createImageBitmap(source);
    let output = source;
    let width = bitmap.width;
    let height = bitmap.height;
    if (Math.max(width, height) > BACKGROUND_IMAGE_MAX_DIMENSION) {
      const scale = BACKGROUND_IMAGE_MAX_DIMENSION / Math.max(width, height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("Background image canvas is unavailable");
      context.drawImage(bitmap, 0, 0, width, height);
      output = await canvas.convertToBlob({
        type: command.mediaType,
        quality: command.mediaType === "image/jpeg" ? 0.92 : undefined,
      });
    }
    const bytes = await output.arrayBuffer();
    scope.postMessage(
      {
        protocol: BACKGROUND_IMAGE_PROTOCOL_VERSION,
        type: "SUCCEEDED",
        correlation: command.correlation,
        bytes,
        mediaType: command.mediaType,
        width,
        height,
      },
      [bytes],
    );
  } catch (error) {
    scope.postMessage({
      protocol: BACKGROUND_IMAGE_PROTOCOL_VERSION,
      type: "FAILED",
      correlation: command.correlation,
      message:
        error instanceof Error ? error.message : "Background image preparation failed",
    });
  } finally {
    bitmap?.close();
  }
}

scope.addEventListener("message", (event) => {
  if (
    event.data.protocol !== BACKGROUND_IMAGE_PROTOCOL_VERSION ||
    event.data.type !== "PREPARE_BACKGROUND_IMAGE"
  )
    return;
  void prepare(event.data);
});
