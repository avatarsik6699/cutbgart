import { describe, expect, it, vi } from "vitest";

import { GUIDED_MODEL } from "@/shared/lib/inference/production-model-config";
import { ProcessingGatewayError } from "@/v2/application";
import {
  createArtifactId,
  createDocumentId,
  createMagicDraftId,
  createRunId,
} from "@/v2/domain";

import { ArtifactRepository } from "../artifacts";
import { HeavyJobCoordinator } from "../processing";
import { MagicWorkerClient } from "./magic-worker-client";
import type { MagicWorker, MagicWorkerFactory } from "./magic-worker-factory";
import {
  MAGIC_WORKER_PROTOCOL_VERSION,
  type MagicWorkerCommand,
  type MagicWorkerEvent,
} from "./magic-worker-protocol";

const correlation = {
  documentId: createDocumentId("document-1"),
  draftId: createMagicDraftId("magic-draft-1"),
  runId: createRunId("magic-run-1"),
  expectedRevision: 2,
  draftRevision: 3,
} as const;

class FakeMagicWorker implements MagicWorker {
  readonly messages: { message: MagicWorkerCommand; transfer: Transferable[] }[] = [];
  readonly terminate = vi.fn();
  readonly #errorListeners: ((event: Event) => void)[] = [];
  readonly #messageListeners: ((event: MessageEvent<MagicWorkerEvent>) => void)[] = [];

  addEventListener(
    type: "message" | "error" | "messageerror",
    listener:
      ((event: MessageEvent<MagicWorkerEvent>) => void) | ((event: Event) => void),
  ): void {
    if (type === "message") {
      this.#messageListeners.push(listener);
    } else {
      this.#errorListeners.push(listener as (event: Event) => void);
    }
  }

  postMessage(message: MagicWorkerCommand, transfer: Transferable[] = []): void {
    this.messages.push({ message, transfer });
  }

  emit(event: MagicWorkerEvent): void {
    for (const listener of this.#messageListeners) {
      listener(new MessageEvent("message", { data: event }));
    }
  }

  crash(message = "Magic worker crashed"): void {
    for (const listener of this.#errorListeners) {
      listener(new ErrorEvent("error", { message }));
    }
  }
}

function createHarness() {
  let nextArtifact = 0;
  const repository = new ArtifactRepository({
    assertions: "throw",
    idSource: { next: () => createArtifactId(`artifact-${++nextArtifact}`) },
    memoryBudgetBytes: 1024,
  });
  const source = repository.register(
    new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    {
      kind: "source",
      mediaType: "image/png",
      width: 2,
      height: 1,
      estimatedBytes: 3,
    },
    { kind: "document", documentId: correlation.documentId },
  );
  const workers: FakeMagicWorker[] = [];
  const factory: MagicWorkerFactory = {
    create() {
      const worker = new FakeMagicWorker();
      workers.push(worker);
      return worker;
    },
  };
  const coordinator = new HeavyJobCoordinator();
  const client = new MagicWorkerClient({ coordinator, factory, repository });
  const input = {
    ...correlation,
    source,
    strokes: [
      {
        id: "stroke-1",
        mode: "keep" as const,
        radius: 5,
        points: [{ x: 1, y: 0 }],
      },
    ],
  };
  return { client, coordinator, input, repository, workers };
}

async function startedWorker(harness: ReturnType<typeof createHarness>) {
  await vi.waitFor(() => expect(harness.workers).toHaveLength(1));
  return harness.workers[0]!;
}

function successEvent(
  overrides: Partial<Extract<MagicWorkerEvent, { type: "SUCCEEDED" }>> = {},
): Extract<MagicWorkerEvent, { type: "SUCCEEDED" }> {
  return {
    protocol: MAGIC_WORKER_PROTOCOL_VERSION,
    type: "SUCCEEDED",
    correlation,
    candidates: [
      { data: new Uint8ClampedArray([0, 255]).buffer, width: 2, height: 1, score: 0.8 },
    ],
    ...overrides,
  };
}

describe("MagicWorkerClient", () => {
  it("transfers the source with full correlation and the exact pinned profile", async () => {
    const harness = createHarness();
    const result = harness.client.predict(
      harness.input,
      new AbortController().signal,
      () => undefined,
    );
    const worker = await startedWorker(harness);

    expect(worker.messages[0]?.message).toMatchObject({
      type: "PREDICT",
      correlation,
      model: GUIDED_MODEL,
      source: { width: 2, height: 1, mediaType: "image/png" },
    });
    expect(worker.messages[0]?.transfer).toHaveLength(1);
    worker.emit(successEvent());
    await expect(result).resolves.toHaveLength(1);
  });

  it("ignores foreign terminals and publishes only monotonic valid progress", async () => {
    const harness = createHarness();
    const published: unknown[] = [];
    const result = harness.client.predict(
      harness.input,
      new AbortController().signal,
      (progress) => published.push(progress),
    );
    const worker = await startedWorker(harness);

    worker.emit({
      ...successEvent(),
      correlation: { ...correlation, draftRevision: 2 },
    });
    worker.emit({
      protocol: MAGIC_WORKER_PROTOCOL_VERSION,
      type: "PROGRESS",
      correlation,
      stage: "magic-encode",
      fraction: 0.5,
    });
    worker.emit({
      protocol: MAGIC_WORKER_PROTOCOL_VERSION,
      type: "PROGRESS",
      correlation,
      stage: "magic-model-loading",
      fraction: 1,
    });
    worker.emit({
      protocol: MAGIC_WORKER_PROTOCOL_VERSION,
      type: "PROGRESS",
      correlation,
      stage: "magic-encode",
      fraction: 0.25,
    });
    worker.emit({
      protocol: MAGIC_WORKER_PROTOCOL_VERSION,
      type: "PROGRESS",
      correlation,
      stage: "magic-predict",
      fraction: null,
    });
    worker.emit(successEvent());

    await expect(result).resolves.toHaveLength(1);
    expect(published).toEqual([
      { stage: "magic-encode", fraction: 0.5 },
      { stage: "magic-predict", fraction: null },
    ]);
  });

  it("forwards cancellation and waits for the correlated acknowledgement", async () => {
    const harness = createHarness();
    const controller = new AbortController();
    const result = harness.client.predict(
      harness.input,
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
      protocol: MAGIC_WORKER_PROTOCOL_VERSION,
      type: "CANCELLED",
      correlation,
    });

    const error: unknown = await result.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProcessingGatewayError);
    expect(error).toMatchObject({ detail: { code: "aborted" } });
  });

  it("shares admission with automatic work and recreates a crashed worker", async () => {
    const harness = createHarness();
    let releaseAutomatic: () => void = () => undefined;
    const automatic = harness.coordinator.schedule({
      kind: "automatic-remove",
      signal: new AbortController().signal,
      execute: () => new Promise<void>((resolve) => (releaseAutomatic = resolve)),
    });
    const first = harness.client.predict(
      harness.input,
      new AbortController().signal,
      () => undefined,
    );
    await Promise.resolve();
    expect(harness.workers).toHaveLength(0);

    releaseAutomatic();
    await automatic;
    const firstWorker = await startedWorker(harness);
    firstWorker.crash();
    await expect(first).rejects.toMatchObject({ detail: { code: "worker-crashed" } });
    expect(firstWorker.terminate).toHaveBeenCalledOnce();

    const second = harness.client.predict(
      { ...harness.input, runId: createRunId("magic-run-2") },
      new AbortController().signal,
      () => undefined,
    );
    await vi.waitFor(() => expect(harness.workers).toHaveLength(2));
    harness.workers[1]!.emit(
      successEvent({
        correlation: { ...correlation, runId: createRunId("magic-run-2") },
      }),
    );
    await expect(second).resolves.toHaveLength(1);
  });

  it("disposes the runtime deterministically and rejects future work", async () => {
    const harness = createHarness();
    const result = harness.client.predict(
      harness.input,
      new AbortController().signal,
      () => undefined,
    );
    const worker = await startedWorker(harness);
    worker.emit(successEvent());
    await result;

    harness.client.dispose();
    expect(worker.messages.at(-1)?.message).toMatchObject({ type: "DISPOSE_RUNTIME" });
    expect(worker.terminate).toHaveBeenCalledOnce();
    await expect(
      harness.client.predict(
        harness.input,
        new AbortController().signal,
        () => undefined,
      ),
    ).rejects.toMatchObject({ detail: { retryable: false } });
  });

  it("resets cached runtime ownership while remaining reusable", async () => {
    const harness = createHarness();
    const first = harness.client.predict(
      harness.input,
      new AbortController().signal,
      () => undefined,
    );
    const worker = await startedWorker(harness);
    worker.emit(successEvent());
    await first;

    harness.client.reset();
    expect(worker.messages.at(-1)?.message).toMatchObject({ type: "DISPOSE_RUNTIME" });
    expect(worker.terminate).toHaveBeenCalledOnce();
    const second = harness.client.predict(
      { ...harness.input, runId: createRunId("magic-run-2") },
      new AbortController().signal,
      () => undefined,
    );
    await vi.waitFor(() => expect(harness.workers).toHaveLength(2));
    harness.workers[1]!.emit(
      successEvent({
        correlation: { ...correlation, runId: createRunId("magic-run-2") },
      }),
    );
    await expect(second).resolves.toHaveLength(1);
  });
});
