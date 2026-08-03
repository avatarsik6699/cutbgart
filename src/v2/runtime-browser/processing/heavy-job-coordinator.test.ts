import { describe, expect, it, vi } from "vitest";

import { HeavyJobCoordinator } from "./heavy-job-coordinator";

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

function deferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe("HeavyJobCoordinator", () => {
  it("admits one automatic or Magic model job globally in FIFO order", async () => {
    const coordinator = new HeavyJobCoordinator();
    const first = deferred<string>();
    const automatic = vi.fn(() => first.promise);
    const magic = vi.fn(() => Promise.resolve("magic"));

    const firstResult = coordinator.schedule({
      kind: "automatic-remove",
      signal: new AbortController().signal,
      execute: automatic,
    });
    const secondResult = coordinator.schedule({
      kind: "magic-cutout",
      signal: new AbortController().signal,
      execute: magic,
    });
    expect(automatic).toHaveBeenCalledOnce();
    expect(magic).not.toHaveBeenCalled();
    expect(coordinator.queued).toBe(1);

    first.resolve("automatic");
    await expect(firstResult).resolves.toBe("automatic");
    await expect(secondResult).resolves.toBe("magic");
    expect(magic).toHaveBeenCalledOnce();
  });

  it("removes a cancelled queued job without starting it", async () => {
    const coordinator = new HeavyJobCoordinator();
    const active = deferred<string>();
    const queuedController = new AbortController();
    const queued = vi.fn(() => Promise.resolve("unexpected"));
    const firstResult = coordinator.schedule({
      kind: "automatic-remove",
      signal: new AbortController().signal,
      execute: () => active.promise,
    });
    const queuedResult = coordinator.schedule({
      kind: "magic-cutout",
      signal: queuedController.signal,
      execute: queued,
    });
    queuedController.abort();
    active.resolve("done");

    await expect(firstResult).resolves.toBe("done");
    await expect(queuedResult).rejects.toMatchObject({ name: "AbortError" });
    expect(queued).not.toHaveBeenCalled();
  });
});
