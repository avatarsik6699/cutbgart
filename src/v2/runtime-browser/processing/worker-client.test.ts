import { describe, expect, it, vi } from "vitest";

import { ProcessingGatewayError } from "@/v2/application";
import {
  createArtifactId,
  createDocumentId,
  createRunId,
  type ProcessingProgress,
  type ProcessingRequest,
} from "@/v2/domain";

import { ArtifactRepository } from "../artifacts";
import type { ProcessingWorker, ProcessingWorkerFactory } from "./worker-factory";
import { WorkerProcessingExecutor } from "./worker-client";
import {
  PROCESSING_WORKER_PROTOCOL_VERSION,
  type ProcessingWorkerCommand,
  type ProcessingWorkerEvent,
} from "./worker-protocol";

const documentId = createDocumentId("document-1");
const runId = createRunId("run-1");
const correlation = { documentId, runId, expectedRevision: 0 } as const;

class FakeWorker implements ProcessingWorker {
  readonly messages: { message: ProcessingWorkerCommand; transfer: Transferable[] }[] =
    [];
  readonly terminate = vi.fn();
  #errorListeners: ((event: Event) => void)[] = [];
  #messageErrorListeners: ((event: Event) => void)[] = [];
  #messageListeners: ((event: MessageEvent<ProcessingWorkerEvent>) => void)[] = [];

  addEventListener(
    type: "message" | "error" | "messageerror",
    listener:
      ((event: MessageEvent<ProcessingWorkerEvent>) => void) | ((event: Event) => void),
  ): void {
    if (type === "message") {
      this.#messageListeners.push(listener);
    } else if (type === "error") {
      this.#errorListeners.push(listener as (event: Event) => void);
    } else {
      this.#messageErrorListeners.push(listener as (event: Event) => void);
    }
  }

  postMessage(message: ProcessingWorkerCommand, transfer: Transferable[] = []): void {
    this.messages.push({ message, transfer });
  }

  emit(event: ProcessingWorkerEvent): void {
    for (const listener of this.#messageListeners) {
      listener(new MessageEvent("message", { data: event }));
    }
  }

  crash(message = "GPU worker crashed"): void {
    for (const listener of this.#errorListeners) {
      listener(new ErrorEvent("error", { message }));
    }
  }
}

function createHarness(
  onExecutionSelected?: ConstructorParameters<
    typeof WorkerProcessingExecutor
  >[0]["onExecutionSelected"],
) {
  let nextArtifact = 0;
  const repository = new ArtifactRepository({
    assertions: "throw",
    idSource: { next: () => createArtifactId(`artifact-${++nextArtifact}`) },
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
  const workers: FakeWorker[] = [];
  const factory: ProcessingWorkerFactory = {
    create() {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  };
  const executor = new WorkerProcessingExecutor({
    factory,
    model: {
      cdnBaseUrl: undefined,
      dtype: "q8",
      inferencePath: "wasm",
      modelId: "onnx-community/ISNet-ONNX",
      onnxRuntimeWebVersion: "1.27.0",
      revision: "revision-1",
    },
    onExecutionSelected,
    repository,
  });
  const request: ProcessingRequest = {
    ...correlation,
    operation: "automatic-remove",
    source,
    modelMode: "isnet-q8",
  };
  return { executor, repository, request, workers };
}

async function startedWorker(
  harness: ReturnType<typeof createHarness>,
): Promise<FakeWorker> {
  await vi.waitFor(() => expect(harness.workers).toHaveLength(1));
  const worker = harness.workers[0];
  if (worker === undefined) {
    throw new Error("Worker was not created");
  }
  return worker;
}

function successEvent(): Extract<ProcessingWorkerEvent, { type: "SUCCEEDED" }> {
  return {
    protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
    type: "SUCCEEDED",
    correlation,
    outputs: {
      matte: new Uint8Array([255]).buffer,
      compositePng: new Uint8Array([137, 80, 78, 71]).buffer,
      width: 1,
      height: 1,
    },
    timings: [],
  };
}

describe("WorkerProcessingExecutor", () => {
  it("publishes only correlated effective execution selections", async () => {
    const onExecutionSelected = vi.fn();
    const harness = createHarness(onExecutionSelected);
    const result = harness.executor.execute(
      harness.request,
      new AbortController().signal,
      () => undefined,
    );
    const worker = await startedWorker(harness);
    worker.emit({
      protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
      type: "EXECUTION_SELECTED",
      correlation: { ...correlation, runId: createRunId("stale") },
      inferencePath: "wasm",
      modelMode: "isnet-fp32",
    });
    worker.emit({
      protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
      type: "EXECUTION_SELECTED",
      correlation,
      inferencePath: "wasm",
      modelMode: "isnet-fp32",
    });
    worker.emit(successEvent());

    await result;
    expect(onExecutionSelected).toHaveBeenCalledOnce();
    expect(onExecutionSelected).toHaveBeenCalledWith(harness.request, {
      inferencePath: "wasm",
      modelMode: "isnet-fp32",
    });
  });

  it("does not create a worker when disposal wins source preparation", async () => {
    const harness = createHarness();
    const result = harness.executor.execute(
      harness.request,
      new AbortController().signal,
      () => undefined,
    );

    await harness.executor.dispose();

    await expect(result).rejects.toMatchObject({ detail: { code: "aborted" } });
    expect(harness.workers).toHaveLength(0);
  });

  it("claims the single heavy slot before asynchronous source transfer", async () => {
    const harness = createHarness();
    const first = harness.executor.execute(
      harness.request,
      new AbortController().signal,
      () => undefined,
    );

    await expect(
      harness.executor.execute(
        { ...harness.request, runId: createRunId("run-2") },
        new AbortController().signal,
        () => undefined,
      ),
    ).rejects.toMatchObject({ detail: { code: "invalid-request" } });

    const worker = await startedWorker(harness);
    worker.emit(successEvent());
    await expect(first).resolves.toBeDefined();
  });

  it("transfers input, publishes monotonic progress, and registers exactly one result", async () => {
    const harness = createHarness();
    const progress: ProcessingProgress[] = [];
    const result = harness.executor.execute(
      harness.request,
      new AbortController().signal,
      (next) => progress.push(next),
    );
    const worker = await startedWorker(harness);

    expect(worker.messages[0]?.message).toMatchObject({
      type: "RUN",
      correlation,
      model: { mode: "isnet-q8" },
    });
    expect(worker.messages[0]?.transfer).toHaveLength(1);
    worker.emit({
      protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
      type: "PROGRESS",
      correlation,
      stage: "model-loading",
      fraction: 1,
      timing: { stage: "model-loading", durationMs: 5 },
    });
    worker.emit(successEvent());
    worker.emit(successEvent());

    await expect(result).resolves.toMatchObject({ foreground: null });
    expect(progress).toHaveLength(1);
    expect(harness.repository.stats()).toMatchObject({ artifacts: 3, leases: 3 });
    harness.repository.releaseOwnerIfPresent({ kind: "run", documentId, runId });
    harness.repository.releaseOwnerIfPresent({ kind: "document", documentId });
    harness.repository.assertEmpty();
  });

  it("acknowledges cancellation before rejecting and ignores foreign terminal events", async () => {
    const harness = createHarness();
    const controller = new AbortController();
    const result = harness.executor.execute(
      harness.request,
      controller.signal,
      () => undefined,
    );
    const worker = await startedWorker(harness);

    controller.abort();
    expect(worker.messages.at(-1)?.message).toMatchObject({
      type: "CANCEL",
      correlation,
    });
    worker.emit({
      ...successEvent(),
      correlation: { ...correlation, runId: createRunId("foreign") },
    });
    worker.emit({
      protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
      type: "CANCELLED",
      correlation,
      timings: [],
    });

    const error: unknown = await result.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProcessingGatewayError);
    expect(error).toMatchObject({ detail: { code: "aborted" } });
  });

  it("rejects invalid progress and creates a fresh worker after a crash", async () => {
    const harness = createHarness();
    const firstResult = harness.executor.execute(
      harness.request,
      new AbortController().signal,
      () => undefined,
    );
    const firstWorker = await startedWorker(harness);
    firstWorker.emit({
      protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
      type: "PROGRESS",
      correlation,
      stage: "decode",
      fraction: 1,
      timing: null,
    });
    firstWorker.emit({
      protocol: PROCESSING_WORKER_PROTOCOL_VERSION,
      type: "PROGRESS",
      correlation,
      stage: "model-loading",
      fraction: 1,
      timing: null,
    });
    await expect(firstResult).rejects.toMatchObject({
      detail: { code: "worker-protocol-error" },
    });

    const secondResult = harness.executor.execute(
      { ...harness.request, runId: createRunId("run-2") },
      new AbortController().signal,
      () => undefined,
    );
    await vi.waitFor(() => expect(firstWorker.messages).toHaveLength(2));
    firstWorker.crash();
    await expect(secondResult).rejects.toMatchObject({
      detail: { code: "worker-crashed" },
    });
    expect(firstWorker.terminate).toHaveBeenCalledOnce();

    const thirdResult = harness.executor.execute(
      { ...harness.request, runId: createRunId("run-3") },
      new AbortController().signal,
      () => undefined,
    );
    await vi.waitFor(() => expect(harness.workers).toHaveLength(2));
    harness.workers[1]?.emit({
      ...successEvent(),
      correlation: { ...correlation, runId: createRunId("run-3") },
    });
    await expect(thirdResult).resolves.toBeDefined();
  });

  it("uses the bounded worker disposal handshake", async () => {
    const harness = createHarness();
    const result = harness.executor.execute(
      harness.request,
      new AbortController().signal,
      () => undefined,
    );
    const worker = await startedWorker(harness);
    worker.emit(successEvent());
    await result;

    const disposal = harness.executor.dispose();
    expect(worker.messages.at(-1)?.message).toMatchObject({ type: "DISPOSE_RUNTIME" });
    worker.emit({ protocol: PROCESSING_WORKER_PROTOCOL_VERSION, type: "DISPOSED" });
    await disposal;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
