import { describe, expect, it } from "vitest";

import { StageMarkRegistry, type PerformanceClock } from "./stage-registry";

class FakeClock implements PerformanceClock {
  nowMs = 0;
  marks: string[] = [];
  measures: string[] = [];

  now() {
    return this.nowMs;
  }
  mark(name: string) {
    this.marks.push(name);
  }
  measure(name: string) {
    this.measures.push(name);
  }
}

describe("StageMarkRegistry", () => {
  it("correlates stage timings by run and emits User Timing names", () => {
    const clock = new FakeClock();
    const registry = new StageMarkRegistry(clock);
    registry.start("run-1", "decode");
    clock.nowMs = 12.5;
    expect(registry.end("run-1", "decode")).toEqual({
      runId: "run-1",
      stage: "decode",
      startedAtMs: 0,
      durationMs: 12.5,
    });
    expect(clock.marks).toEqual(["v2:run-1:decode:start", "v2:run-1:decode:end"]);
    expect(clock.measures).toEqual(["v2:run-1:decode"]);
    expect(() => registry.assertNoActiveStages()).not.toThrow();
  });

  it("rejects duplicate starts, unmatched ends, and unfinished reports", () => {
    const registry = new StageMarkRegistry(new FakeClock());
    registry.start("run-1", "model-load");
    expect(() => registry.start("run-1", "model-load")).toThrow("Stage already active");
    expect(() => registry.end("other", "model-load")).toThrow("Stage is not active");
    expect(() => registry.assertNoActiveStages()).toThrow(
      "Unfinished performance stages",
    );
  });
});
