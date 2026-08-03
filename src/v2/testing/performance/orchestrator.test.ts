import { describe, expect, it } from "vitest";

import {
  assemblePerformanceReport,
  DeterministicPerformanceAdapter,
} from "./orchestrator";
import { isPerformanceReportV1, PERFORMANCE_REPORT_SCHEMA_VERSION } from "./report";
import { StageMarkRegistry, type PerformanceClock } from "./stage-registry";

const clock: PerformanceClock = {
  now: () => 10,
  mark: () => undefined,
  measure: () => undefined,
};

describe("performance report orchestration", () => {
  it("assembles the same passing report shape for every run kind", () => {
    const scenarios = [
      { gateway: "fake", environmentKind: "automated-host" },
      { gateway: "real-model", environmentKind: "automated-host" },
      { gateway: "real-model", environmentKind: "target-device" },
    ] as const;
    for (const scenario of scenarios) {
      const stages = new StageMarkRegistry(clock);
      stages.start("run", "decode");
      stages.end("run", "decode");
      const adapter = new DeterministicPerformanceAdapter().with({
        interactions: [
          { name: "scroll", kind: "scroll", eventToNextPaintMs: 20, missed: false },
        ],
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
      const report = assemblePerformanceReport({
        run: {
          id: `run-${scenario.gateway}-${scenario.environmentKind}`,
          ...scenario,
          cacheState: scenario.gateway === "fake" ? "not-applicable" : "warm",
        },
        adapter,
        stages,
      });

      expect(report.schemaVersion).toBe(PERFORMANCE_REPORT_SCHEMA_VERSION);
      expect(report.evaluation.status).toBe("pass");
      expect(isPerformanceReportV1(JSON.parse(JSON.stringify(report)))).toBe(true);
    }
  });

  it("refuses to assemble a report while a stage remains active", () => {
    const stages = new StageMarkRegistry(clock);
    stages.start("run", "inference");
    expect(() =>
      assemblePerformanceReport({
        run: {
          id: "run",
          gateway: "fake",
          environmentKind: "automated-host",
          cacheState: "not-applicable",
        },
        adapter: new DeterministicPerformanceAdapter(),
        stages,
      }),
    ).toThrow("Unfinished performance stages");
  });
});
