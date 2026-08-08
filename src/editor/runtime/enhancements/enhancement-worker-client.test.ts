import { describe, expect, it, vi } from "vitest";

import { createDocumentId, createEnhancementDraftId, createRunId } from "@/editor/domain";

import { EnhancementWorkerClient } from "./enhancement-worker-client";
import type { EnhancementWorker } from "./enhancement-worker-factory";
import {
  ENHANCEMENT_WORKER_PROTOCOL_VERSION,
  type EnhancementWorkerCommand,
} from "./enhancement-worker-protocol";

class FakeWorker extends EventTarget {
  readonly messages: EnhancementWorkerCommand[] = [];
  readonly transfers: Transferable[][] = [];
  readonly terminate = vi.fn();

  postMessage(message: EnhancementWorkerCommand, transfer: Transferable[] = []): void {
    this.messages.push(message);
    this.transfers.push(transfer);
  }

  emit(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

function input(operationId: "fine-detail" | "colour-halo" = "fine-detail") {
  return {
    documentId: createDocumentId("document-1"),
    draftId: createEnhancementDraftId("enhancement-draft-1"),
    runId: createRunId("enhancement-run-1"),
    expectedRevision: 3,
    operationId,
    source: new Blob(["source"], { type: "image/png" }),
    matte: new Uint8ClampedArray([10, 20]),
    width: 2,
    height: 1,
  } as const;
}

describe("EnhancementWorkerClient", () => {
  it("transfers binary inputs, ignores foreign terminals, and resolves a typed result", async () => {
    const worker = new FakeWorker();
    const client = new EnhancementWorkerClient({
      create: () => worker as unknown as EnhancementWorker,
    });
    const request = input();
    const publish = vi.fn();
    const result = client.run(request, new AbortController().signal, publish);
    await vi.waitFor(() => expect(worker.messages).toHaveLength(1));
    const command = worker.messages[0];
    expect(command).toMatchObject({
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "RUN",
      correlation: {
        documentId: request.documentId,
        draftId: request.draftId,
        runId: request.runId,
        expectedRevision: 3,
        operationId: "fine-detail",
      },
    });
    expect(
      Object.keys(command && "correlation" in command ? command.correlation : {}),
    ).toEqual(["documentId", "draftId", "runId", "expectedRevision", "operationId"]);
    expect(worker.transfers[0]).toHaveLength(2);
    worker.emit({
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "SUCCEEDED",
      correlation: { ...request, runId: createRunId("foreign-run") },
      output: {
        operationId: "fine-detail",
        matte: new Uint8Array([1, 2]).buffer,
        changed: true,
        actualMode: "balanced",
        actualPath: "wasm",
        fallback: "none",
      },
    });
    worker.emit({
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "PROGRESS",
      correlation: request,
      stage: "enhancement-fine-detail",
      fraction: 0.5,
    });
    worker.emit({
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "SUCCEEDED",
      correlation: request,
      output: {
        operationId: "fine-detail",
        matte: new Uint8Array([30, 40]).buffer,
        changed: true,
        actualMode: "balanced",
        actualPath: "wasm",
        fallback: "none",
      },
    });
    await expect(result).resolves.toMatchObject({
      operationId: "fine-detail",
      matte: new Uint8ClampedArray([30, 40]),
      changed: true,
    });
    expect(publish).toHaveBeenCalledWith({
      stage: "enhancement-fine-detail",
      fraction: 0.5,
    });
  });

  it("terminates the warm runtime and rejects immediately on cancellation", async () => {
    const worker = new FakeWorker();
    const client = new EnhancementWorkerClient({
      create: () => worker as unknown as EnhancementWorker,
    });
    const controller = new AbortController();
    const result = client.run(input(), controller.signal, vi.fn());
    await vi.waitFor(() => expect(worker.messages).toHaveLength(1));
    controller.abort();
    await expect(result).rejects.toMatchObject({ detail: { code: "aborted" } });
    expect(worker.messages.some(({ type }) => type === "CANCEL")).toBe(true);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("rejects malformed matching terminals and crash-recovers the worker", async () => {
    const worker = new FakeWorker();
    const client = new EnhancementWorkerClient({
      create: () => worker as unknown as EnhancementWorker,
    });
    const result = client.run(input(), new AbortController().signal, vi.fn());
    await vi.waitFor(() => expect(worker.messages).toHaveLength(1));
    worker.emit({ protocol: 999, type: "SUCCEEDED" });
    await expect(result).rejects.toMatchObject({
      detail: { code: "worker-protocol-error" },
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("rejects an unknown structured error code at the worker boundary", async () => {
    const worker = new FakeWorker();
    const client = new EnhancementWorkerClient({
      create: () => worker as unknown as EnhancementWorker,
    });
    const request = input();
    const result = client.run(request, new AbortController().signal, vi.fn());
    await vi.waitFor(() => expect(worker.messages).toHaveLength(1));
    worker.emit({
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "FAILED",
      correlation: request,
      error: {
        code: "future-unvalidated-code",
        message: "invalid error contract",
        retryable: true,
      },
    });
    await expect(result).rejects.toMatchObject({
      detail: { code: "worker-protocol-error" },
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("rejects a correlated matte whose dimensions do not match the request", async () => {
    const worker = new FakeWorker();
    const client = new EnhancementWorkerClient({
      create: () => worker as unknown as EnhancementWorker,
    });
    const request = input();
    const result = client.run(request, new AbortController().signal, vi.fn());
    await vi.waitFor(() => expect(worker.messages).toHaveLength(1));
    worker.emit({
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "SUCCEEDED",
      correlation: request,
      output: {
        operationId: "fine-detail",
        matte: new Uint8Array([30]).buffer,
        changed: true,
        actualMode: "balanced",
        actualPath: "wasm",
        fallback: "none",
      },
    });
    await expect(result).rejects.toMatchObject({
      detail: { code: "worker-protocol-error" },
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("preserves structured OOM failures and suppresses regressive progress", async () => {
    const worker = new FakeWorker();
    const client = new EnhancementWorkerClient({
      create: () => worker as unknown as EnhancementWorker,
    });
    const request = input();
    const publish = vi.fn();
    const result = client.run(request, new AbortController().signal, publish);
    await vi.waitFor(() => expect(worker.messages).toHaveLength(1));
    worker.emit({
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "PROGRESS",
      correlation: request,
      stage: "enhancement-fine-detail",
      fraction: 0.75,
    });
    worker.emit({
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "PROGRESS",
      correlation: request,
      stage: "enhancement-fine-detail",
      fraction: 0.25,
    });
    expect(publish).toHaveBeenCalledTimes(1);
    worker.emit({
      protocol: ENHANCEMENT_WORKER_PROTOCOL_VERSION,
      type: "FAILED",
      correlation: request,
      error: {
        code: "device-out-of-memory",
        message: "GPU allocation failed",
        retryable: true,
      },
    });
    await expect(result).rejects.toMatchObject({
      detail: {
        code: "device-out-of-memory",
        message: "GPU allocation failed",
        retryable: true,
      },
    });
  });
});
