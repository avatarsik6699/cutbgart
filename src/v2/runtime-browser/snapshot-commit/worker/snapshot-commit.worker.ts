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

async function materialize(command: SnapshotCommitWorkerCommand): Promise<void> {
  try {
    const source = new Blob([command.source.bytes], { type: command.source.mediaType });
    const bitmap = await createImageBitmap(source);
    try {
      if (bitmap.width !== command.width || bitmap.height !== command.height) {
        throw new Error("Snapshot source dimensions changed");
      }
      const matte = new Uint8ClampedArray(command.matte);
      const canvas = new OffscreenCanvas(command.width, command.height);
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("Snapshot composite canvas is unavailable");
      context.drawImage(bitmap, 0, 0);
      const image = context.getImageData(0, 0, command.width, command.height);
      applyMatte(image, matte);
      context.clearRect(0, 0, command.width, command.height);
      context.putImageData(image, 0, 0);
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
    } finally {
      bitmap.close();
    }
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
