import { describe, expect, it, vi } from "vitest";

import { createWorkspaceItemId } from "@/v2/domain";
import type { ImageImportPreparation } from "../editor-session";
import { BatchImportCoordinator } from "./batch-import-coordinator";

function png(name: string): File {
  return new File([new Uint8Array([1])], name, { type: "image/png" });
}

describe("BatchImportCoordinator", () => {
  it("admits at most two preparations and preserves each item correlation", async () => {
    let active = 0;
    let maximum = 0;
    const releases: (() => void)[] = [];
    const coordinator = new BatchImportCoordinator((file) => {
      active += 1;
      maximum = Math.max(maximum, active);
      return new Promise<ImageImportPreparation>((resolve) => {
        releases.push(() => {
          active -= 1;
          resolve({
            ok: true,
            value: { file, width: 1, height: 1, mediaType: "image/png" },
          });
        });
      });
    });
    const tasks = [1, 2, 3, 4].map((value) => ({
      itemId: createWorkspaceItemId(`item-${value}`),
      file: png(`${value}.png`),
    }));
    const results = tasks.map((task) => coordinator.prepare(task));
    expect(maximum).toBe(2);
    releases[0]?.();
    await vi.waitFor(() => expect(releases).toHaveLength(3));
    releases[1]?.();
    await vi.waitFor(() => expect(releases).toHaveLength(4));
    releases[2]?.();
    releases[3]?.();
    const settled = await Promise.all(results);
    expect(maximum).toBe(2);
    expect(settled.map((result) => result.itemId)).toEqual(
      tasks.map((task) => task.itemId),
    );
  });

  it("cancels queued work without disturbing admitted siblings", async () => {
    const activeReleases: (() => void)[] = [];
    const coordinator = new BatchImportCoordinator(
      (file) =>
        new Promise<ImageImportPreparation>((resolve) => {
          activeReleases.push(() =>
            resolve({
              ok: true,
              value: { file, width: 1, height: 1, mediaType: "image/png" },
            }),
          );
        }),
    );
    const first = coordinator.prepare({
      itemId: createWorkspaceItemId("first"),
      file: png("first.png"),
    });
    const second = coordinator.prepare({
      itemId: createWorkspaceItemId("second"),
      file: png("second.png"),
    });
    const queuedId = createWorkspaceItemId("queued");
    const queued = coordinator.prepare({ itemId: queuedId, file: png("queued.png") });
    coordinator.cancel(queuedId);
    await expect(queued).resolves.toMatchObject({ ok: false, error: "cancelled" });
    for (const release of activeReleases) release();
    coordinator.dispose();
    await Promise.all([first, second]);
  });

  it("aborts active preparation when its item is cancelled", async () => {
    const itemId = createWorkspaceItemId("active");
    let receivedSignal: AbortSignal | undefined;
    const coordinator = new BatchImportCoordinator((_file, _runtime, signal) => {
      receivedSignal = signal;
      return new Promise<ImageImportPreparation>((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => reject(new DOMException("cancelled", "AbortError")),
          { once: true },
        );
      });
    });

    const result = coordinator.prepare({ itemId, file: png("active.png") });
    coordinator.cancel(itemId);

    expect(receivedSignal?.aborted).toBe(true);
    await expect(result).resolves.toMatchObject({ ok: false, error: "cancelled" });
  });

  it("aborts every active preparation on dispose", async () => {
    const signals: AbortSignal[] = [];
    const coordinator = new BatchImportCoordinator((_file, _runtime, signal) => {
      if (signal !== undefined) signals.push(signal);
      return new Promise<ImageImportPreparation>((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => reject(new DOMException("cancelled", "AbortError")),
          { once: true },
        );
      });
    });
    const first = coordinator.prepare({
      itemId: createWorkspaceItemId("dispose-first"),
      file: png("first.png"),
    });
    const second = coordinator.prepare({
      itemId: createWorkspaceItemId("dispose-second"),
      file: png("second.png"),
    });

    coordinator.dispose();

    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ ok: false, error: "cancelled" }),
      expect.objectContaining({ ok: false, error: "cancelled" }),
    ]);
  });
});
