import { applyMatte } from "../../image-processing";
import {
  SNAPSHOT_COMMIT_PROTOCOL_VERSION,
  type SnapshotCommitWorkerCommand,
  type SnapshotCommitWorkerEvent,
} from "../snapshot-commit-protocol";

type WorkerScope = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<SnapshotCommitWorkerCommand>) => void,
  ): void;
  postMessage(message: SnapshotCommitWorkerEvent, transfer?: Transferable[]): void;
};

const scope = globalThis as unknown as WorkerScope;

function coverRect(
  source: { width: number; height: number },
  target: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(target.width / source.width, target.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return {
    x: (target.width - width) / 2,
    y: (target.height - height) / 2,
    width,
    height,
  };
}

async function drawBackground(
  context: OffscreenCanvasRenderingContext2D,
  command: SnapshotCommitWorkerCommand,
): Promise<void> {
  const { background, width, height } = command;
  switch (background.type) {
    case "transparent":
      return;
    case "color":
      context.fillStyle = background.value;
      context.fillRect(0, 0, width, height);
      return;
    case "gradient": {
      const gradient =
        background.kind === "linear"
          ? context.createLinearGradient(0, height / 2, width, height / 2)
          : context.createRadialGradient(
              width / 2,
              height / 2,
              0,
              width / 2,
              height / 2,
              Math.hypot(width / 2, height / 2),
            );
      for (const stop of background.stops) gradient.addColorStop(stop.offset, stop.color);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      return;
    }
    case "image": {
      const bitmap = await createImageBitmap(
        new Blob([background.bytes], { type: background.mediaType }),
      );
      try {
        const rect = coverRect(bitmap, { width, height });
        context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height);
      } finally {
        bitmap.close();
      }
    }
  }
}

async function drawForeground(
  context: OffscreenCanvasRenderingContext2D,
  command: SnapshotCommitWorkerCommand,
): Promise<void> {
  const encoded = command.foreground ?? command.source;
  const bitmap = await createImageBitmap(
    new Blob([encoded.bytes], { type: encoded.mediaType }),
  );
  try {
    if (bitmap.width !== command.width || bitmap.height !== command.height) {
      throw new Error("Snapshot foreground dimensions changed");
    }
    const foreground = new OffscreenCanvas(command.width, command.height);
    const foregroundContext = foreground.getContext("2d");
    if (foregroundContext === null)
      throw new Error("Snapshot foreground canvas is unavailable");
    foregroundContext.drawImage(bitmap, 0, 0);
    const image = foregroundContext.getImageData(0, 0, command.width, command.height);
    applyMatte(image, new Uint8ClampedArray(command.matte));
    foregroundContext.clearRect(0, 0, command.width, command.height);
    foregroundContext.putImageData(image, 0, 0);
    context.drawImage(foreground, 0, 0);
  } finally {
    bitmap.close();
  }
}

async function materialize(command: SnapshotCommitWorkerCommand): Promise<void> {
  try {
    const canvas = new OffscreenCanvas(command.width, command.height);
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Snapshot composite canvas is unavailable");
    await drawBackground(context, command);
    await drawForeground(context, command);
    const png = await canvas.convertToBlob({ type: "image/png" });
    const compositePng = await png.arrayBuffer();
    scope.postMessage(
      {
        protocol: SNAPSHOT_COMMIT_PROTOCOL_VERSION,
        type: "SUCCEEDED",
        correlation: command.correlation,
        compositePng,
      },
      [compositePng],
    );
  } catch (error) {
    scope.postMessage({
      protocol: SNAPSHOT_COMMIT_PROTOCOL_VERSION,
      type: "FAILED",
      correlation: command.correlation,
      message: error instanceof Error ? error.message : "Snapshot commit failed",
    });
  }
}

scope.addEventListener("message", (event) => {
  const command = event.data;
  if (
    command.protocol !== SNAPSHOT_COMMIT_PROTOCOL_VERSION ||
    command.type !== "MATERIALIZE_SNAPSHOT"
  ) {
    return;
  }
  void materialize(command);
});
