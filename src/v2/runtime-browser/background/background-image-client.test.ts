import { describe, expect, it, vi } from "vitest";

import { createBackgroundDraftId, createDocumentId } from "@/v2/domain";

import { BackgroundImageClient } from "./background-image-client";
import type { BackgroundImageWorker } from "./background-image-worker-factory";
import { BACKGROUND_IMAGE_PROTOCOL_VERSION } from "./background-image-protocol";

class FakeBackgroundWorker implements BackgroundImageWorker {
  readonly listeners = new Map<string, Set<(event: never) => void>>();
  readonly messages: unknown[] = [];
  readonly terminate = vi.fn();

  addEventListener(type: string, listener: (event: never) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: never) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message: unknown, transfer: Transferable[]): void {
    this.messages.push({ message, transfer });
  }

  succeed(): void {
    const posted = this.messages[0] as {
      message: { correlation: object; mediaType: "image/png" };
    };
    const event = new MessageEvent("message", {
      data: {
        protocol: BACKGROUND_IMAGE_PROTOCOL_VERSION,
        type: "SUCCEEDED",
        correlation: posted.message.correlation,
        bytes: new Uint8Array([1, 2, 3]).buffer,
        mediaType: posted.message.mediaType,
        width: 2,
        height: 1,
      },
    });
    for (const listener of this.listeners.get("message") ?? []) listener(event as never);
  }

  emit(data: unknown): void {
    const event = new MessageEvent("message", { data });
    for (const listener of this.listeners.get("message") ?? []) listener(event as never);
  }
}

const correlation = {
  documentId: createDocumentId("document-1"),
  draftId: createBackgroundDraftId("background-draft-1"),
  draftRevision: 1,
};

describe("BackgroundImageClient", () => {
  it("transfers valid image bytes and accepts only a matching typed terminal", async () => {
    const worker = new FakeBackgroundWorker();
    const client = new BackgroundImageClient({ create: () => worker });
    const result = client.prepare(
      new File([new Uint8Array([1, 2])], "background.png", { type: "image/png" }),
      correlation,
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(worker.messages).toHaveLength(1));
    const posted = worker.messages[0] as { message: object; transfer: Transferable[] };
    expect(posted.message).toMatchObject({
      protocol: BACKGROUND_IMAGE_PROTOCOL_VERSION,
      type: "PREPARE_BACKGROUND_IMAGE",
      correlation,
      mediaType: "image/png",
    });
    expect(posted.transfer).toHaveLength(1);
    worker.succeed();
    await expect(result).resolves.toMatchObject({
      mediaType: "image/png",
      width: 2,
      height: 1,
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("rejects unsupported and oversized files before creating a worker", async () => {
    const create = vi.fn(() => new FakeBackgroundWorker());
    const client = new BackgroundImageClient({ create });
    await expect(
      client.prepare(
        new File(["text"], "background.gif", { type: "image/gif" }),
        correlation,
        new AbortController().signal,
      ),
    ).rejects.toThrow("Unsupported");
    const oversized = new File([new Uint8Array(20 * 1024 * 1024 + 1)], "large.png", {
      type: "image/png",
    });
    await expect(
      client.prepare(oversized, correlation, new AbortController().signal),
    ).rejects.toThrow("20 MiB");
    expect(create).not.toHaveBeenCalled();
  });

  it("terminates the worker when preparation is cancelled", async () => {
    const worker = new FakeBackgroundWorker();
    const client = new BackgroundImageClient({ create: () => worker });
    const controller = new AbortController();
    const result = client.prepare(
      new File([new Uint8Array([1])], "background.png", { type: "image/png" }),
      correlation,
      controller.signal,
    );
    await vi.waitFor(() => expect(worker.messages).toHaveLength(1));
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("rejects a matching terminal that exceeds the decoded dimension limit", async () => {
    const worker = new FakeBackgroundWorker();
    const client = new BackgroundImageClient({ create: () => worker });
    const result = client.prepare(
      new File([new Uint8Array([1])], "background.png", { type: "image/png" }),
      correlation,
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(worker.messages).toHaveLength(1));
    worker.emit({
      protocol: BACKGROUND_IMAGE_PROTOCOL_VERSION,
      type: "SUCCEEDED",
      correlation,
      bytes: new Uint8Array([1]).buffer,
      mediaType: "image/png",
      width: 4097,
      height: 1,
    });
    await expect(result).rejects.toThrow("Invalid background image worker event");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
