import { describe, expect, it } from "vitest";

import { evaluatePerformanceBudget, nearestRankPercentile } from "./evaluate";
import type { PerformanceSupport } from "./report";

const supported: PerformanceSupport = {
  userTiming: "supported",
  longTasks: "supported",
  eventTiming: "supported",
  resources: "supported",
};

describe("performance budget evaluation", () => {
  it("uses the nearest-rank percentile and strict latency thresholds", () => {
    expect(nearestRankPercentile([40, 10, 30, 20], 95)).toBe(40);
    expect(() => nearestRankPercentile([1], 0)).toThrow(RangeError);

    const evaluation = evaluatePerformanceBudget({
      support: supported,
      interactions: Array.from({ length: 20 }, (_, index) => ({
        name: `scroll-${String(index)}`,
        kind: "scroll" as const,
        eventToNextPaintMs: index >= 18 ? 100 : 20,
        missed: false,
      })),
      longTasks: [],
      artifacts: [
        {
          point: "after-reset",
          artifactCount: 0,
          leaseCount: 0,
          byteCount: 0,
          objectUrlCount: 0,
          workerCount: 0,
          sessionCount: 0,
          listenerCount: 0,
        },
      ],
    });

    expect(evaluation.status).toBe("fail");
    expect(
      evaluation.checks.find((check) => check.name === "interactionP95Ms"),
    ).toMatchObject({
      observed: 100,
      status: "fail",
    });
  });

  it("never presents unsupported or absent metrics as zero", () => {
    const evaluation = evaluatePerformanceBudget({
      support: { ...supported, longTasks: "unsupported", eventTiming: "unknown" },
      interactions: [],
      longTasks: [],
      artifacts: [],
    });

    expect(evaluation.status).toBe("inconclusive");
    expect(evaluation.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "maximumLongTaskMs", observed: null }),
        expect.objectContaining({ name: "interactionP95Ms", observed: null }),
        expect.objectContaining({ name: "maximumFinalLeaseCount", observed: null }),
      ]),
    );
  });

  it("fails long tasks, missed actions, and reachable final leases", () => {
    const evaluation = evaluatePerformanceBudget({
      support: supported,
      interactions: [
        { name: "control", kind: "control", eventToNextPaintMs: 20, missed: true },
      ],
      longTasks: [{ startedAtMs: 10, durationMs: 50, attribution: "application" }],
      artifacts: [
        {
          point: "final",
          artifactCount: 1,
          leaseCount: 2,
          byteCount: 128,
          objectUrlCount: 1,
          workerCount: 1,
          sessionCount: 1,
          listenerCount: null,
        },
      ],
    });

    expect(evaluation.status).toBe("fail");
    expect(evaluation.checks.filter((check) => check.status === "fail")).toHaveLength(4);
  });
});
