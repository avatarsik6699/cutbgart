import { validateAndPrepareUpload } from "../model/validate-and-prepare-upload";
import type { UploadPreparationTypes } from "../model/upload-preparation.types";

type WorkerScope = {
  postMessage(message: UploadPreparationTypes.Response): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<UploadPreparationTypes.Request>) => void,
  ): void;
};

const workerScope = globalThis as unknown as WorkerScope;
let preparationQueue = Promise.resolve();

function preparationFailure(reason: unknown): UploadPreparationTypes.Response["result"] {
  return {
    ok: false,
    error: {
      code: "unsupported-format",
      message: `Could not prepare this image: ${reason instanceof Error ? reason.message : String(reason)}`,
    },
  };
}

async function prepare(request: UploadPreparationTypes.Request): Promise<void> {
  let result: UploadPreparationTypes.Response["result"];
  try {
    result = await validateAndPrepareUpload(request.file);
  } catch (reason) {
    result = preparationFailure(reason);
  }
  workerScope.postMessage({
    type: "prepared",
    requestId: request.requestId,
    result,
  });
}

workerScope.addEventListener("message", (event) => {
  const request = event.data;
  preparationQueue = preparationQueue.then(() => prepare(request));
});
