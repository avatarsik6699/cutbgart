import { describe, expect, it } from "vitest";

import { deriveBatchSchedulerSnapshot, type BatchSession } from "./types";

describe("deriveBatchSchedulerSnapshot", () => {
  it("derives all counts from item state", () => {
    const item = (status: "queued" | "processing" | "result" | "error", id: string) => ({
      id,
      originalFileName: `${id}.jpg`,
      source: { blob: new Blob(), width: 1, height: 1, format: "image/jpeg" as const },
      qualityMode: "fast" as const,
      status,
      enqueuedAt: 0,
      processingProgress: {
        stage: status === "processing" ? ("inference" as const) : ("queued" as const),
        startedAt: null,
        elapsedMs: 0,
        percent: null,
      },
    });
    const session: BatchSession = {
      items: [
        item("queued", "q"),
        item("processing", "p"),
        item("result", "r"),
        item("error", "e"),
      ],
      selectedItemId: null,
      modelLoads: {},
    };
    expect(deriveBatchSchedulerSnapshot(session, "webgpu", 2)).toEqual({
      inferencePath: "webgpu",
      concurrencyLimit: 2,
      activeCount: 1,
      queuedCount: 1,
      completedCount: 1,
      failedCount: 1,
      totalCount: 4,
    });
  });
});
