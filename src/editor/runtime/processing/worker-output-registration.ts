import { ProcessingGatewayError } from "@/editor/application";
import type { DocumentSnapshot, ProcessingRequest } from "@/editor/domain";

import type { ArtifactRepository } from "../artifacts";
import type { ProcessingWorkerEvent } from "./worker-protocol";

export function registerWorkerOutput(
  repository: ArtifactRepository,
  request: ProcessingRequest,
  event: Extract<ProcessingWorkerEvent, { type: "SUCCEEDED" }>,
): DocumentSnapshot {
  const owner = {
    kind: "run",
    documentId: request.documentId,
    runId: request.runId,
  } as const;
  try {
    const matte = repository.register(
      new Uint8ClampedArray(event.outputs.matte),
      {
        kind: "matte",
        mediaType: "application/octet-stream",
        width: event.outputs.width,
        height: event.outputs.height,
        estimatedBytes: event.outputs.matte.byteLength,
      },
      owner,
    );
    const composite = repository.register(
      new Blob([event.outputs.compositePng], { type: "image/png" }),
      {
        kind: "composite",
        mediaType: "image/png",
        width: event.outputs.width,
        height: event.outputs.height,
        estimatedBytes: event.outputs.compositePng.byteLength,
      },
      owner,
    );
    return {
      matte,
      foreground: null,
      composite,
      background: { type: "transparent" },
    };
  } catch (error) {
    repository.releaseOwnerIfPresent(owner);
    if (error instanceof ProcessingGatewayError) throw error;
    throw new ProcessingGatewayError({
      code: "processing-failed",
      message:
        error instanceof Error ? error.message : "Could not register worker output",
      retryable: true,
    });
  }
}
