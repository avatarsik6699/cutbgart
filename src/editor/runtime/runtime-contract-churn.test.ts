import { describe, expect, it, vi } from "vitest";

import {
  createArtifactId,
  createDocumentId,
  createRunId,
  type ProcessingRequest,
} from "@/editor/domain";
import { WorkerScenarioDriver } from "@/editor/testing";

import {
  ArtifactRepository,
  PROCESSING_WORKER_PROTOCOL_VERSION,
  WorkerProcessingExecutor,
} from "./index";

describe("production worker/browser adapter churn", () => {
  it("transfers and releases every result across repeated correlated runs", async () => {
    const documentId = createDocumentId("document-churn");
    let artifactSequence = 0;
    const repository = new ArtifactRepository({
      assertions: "throw",
      idSource: {
        next: () => createArtifactId(`artifact-${String(++artifactSequence)}`),
      },
      memoryBudgetBytes: 1024 * 1024,
    });
    const source = repository.register(
      new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
      {
        kind: "source",
        mediaType: "image/png",
        width: 1,
        height: 1,
        estimatedBytes: 3,
      },
      { kind: "document", documentId },
    );
    const worker = new WorkerScenarioDriver();
    const executor = new WorkerProcessingExecutor({
      factory: { create: () => worker },
      model: {
        cdnBaseUrl: undefined,
        dtype: "q8",
        inferencePath: "wasm",
        modelId: "onnx-community/ISNet-ONNX",
        onnxRuntimeWebVersion: "1.27.0",
        revision: "revision-1",
      },
      repository,
    });

    for (let iteration = 0; iteration < 25; iteration += 1) {
      const runId = createRunId(`run-${String(iteration)}`);
      const request: ProcessingRequest = {
        documentId,
        runId,
        expectedRevision: iteration,
        operation: "automatic-remove",
        source,
        modelMode: "isnet-q8",
      };
      const result = executor.execute(
        request,
        new AbortController().signal,
        () => undefined,
      );
      await vi.waitFor(() => {
        expect(worker.commands.at(-1)).toMatchObject({
          type: "RUN",
          correlation: request,
        });
      });
      expect(worker.transfers.at(-1)).toHaveLength(1);
      worker.emit({
        protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
        type: "SUCCEEDED",
        correlation: request,
        outputs: {
          matte: new Uint8Array([255]).buffer,
          compositePng: new Uint8Array([137, 80, 78, 71]).buffer,
          width: 1,
          height: 1,
        },
        timings: [{ stage: "automatic-remove", durationMs: 1 }],
      });
      await expect(result).resolves.toBeDefined();
      repository.releaseOwnerIfPresent({ kind: "run", documentId, runId });
      expect(repository.stats()).toEqual({
        artifacts: 1,
        leases: 1,
        objectUrls: 0,
        estimatedBytes: 3,
      });
    }

    const disposal = executor.dispose();
    await vi.waitFor(() => {
      expect(worker.commands.at(-1)).toMatchObject({ type: "DISPOSE_RUNTIME" });
    });
    worker.emit({ protocol: PROCESSING_WORKER_PROTOCOL_VERSION, type: "DISPOSED" });
    await disposal;
    repository.releaseOwnerIfPresent({ kind: "document", documentId });
    repository.assertEmpty();
    expect(worker.terminated()).toBe(true);
  });
});
