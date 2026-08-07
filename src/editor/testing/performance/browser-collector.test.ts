import { describe, expect, it } from "vitest";

import { BrowserPerformanceCollector } from "./browser-collector";

describe("BrowserPerformanceCollector", () => {
  it("collects explicit browser samples and rejects ambiguous missing durations", () => {
    const collector = new BrowserPerformanceCollector({
      environment: { browser: "Chrome 150", platform: "Win32", gpuPath: "webgpu" },
      source: { supportedEntryTypes: ["resource", "event"], resources: () => [] },
      nowIso: () => "2026-08-01T00:00:00.000Z",
      observe: false,
    });
    collector.recordInteraction({
      name: "scroll",
      kind: "scroll",
      eventToNextPaintMs: 24,
      missed: false,
    });
    collector.addLimitation("synthetic fixture");

    expect(collector.interactions()).toHaveLength(1);
    expect(collector.resources()).toEqual([]);
    expect(collector.limitations()).toEqual(["synthetic fixture"]);
    expect(() =>
      collector.recordInteraction({
        name: "unknown",
        kind: "control",
        eventToNextPaintMs: null,
        missed: false,
      }),
    ).toThrow("must be marked as a missed action");
  });
});
