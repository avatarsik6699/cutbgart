import type { PerformanceStage, StageSample } from "./report";

export type PerformanceClock = {
  now(): number;
  mark(name: string): void;
  measure(name: string, startMark: string, endMark: string): void;
};

function nativeClock(): PerformanceClock {
  if (typeof performance === "undefined") {
    throw new Error("User Timing is unavailable in this runtime");
  }
  return {
    now: () => performance.now(),
    mark: (name) => performance.mark(name),
    measure: (name, start, end) => performance.measure(name, start, end),
  };
}

type ActiveStage = { startedAtMs: number; startMark: string };

export class StageMarkRegistry {
  readonly #clock: PerformanceClock;
  readonly #active = new Map<string, ActiveStage>();
  readonly #samples: StageSample[] = [];

  constructor(clock: PerformanceClock = nativeClock()) {
    this.#clock = clock;
  }

  start(runId: string, stage: PerformanceStage): void {
    const key = `${runId}:${stage}`;
    if (this.#active.has(key)) throw new Error(`Stage already active: ${key}`);
    const startMark = `v2:${key}:start`;
    this.#clock.mark(startMark);
    this.#active.set(key, { startedAtMs: this.#clock.now(), startMark });
  }

  end(runId: string, stage: PerformanceStage): StageSample {
    const key = `${runId}:${stage}`;
    const active = this.#active.get(key);
    if (!active) throw new Error(`Stage is not active: ${key}`);
    const endMark = `v2:${key}:end`;
    const endedAtMs = this.#clock.now();
    this.#clock.mark(endMark);
    this.#clock.measure(`v2:${key}`, active.startMark, endMark);
    this.#active.delete(key);
    const sample = {
      runId,
      stage,
      startedAtMs: active.startedAtMs,
      durationMs: endedAtMs - active.startedAtMs,
    };
    this.#samples.push(sample);
    return sample;
  }

  samples(): StageSample[] {
    return this.#samples.map((sample) => ({ ...sample }));
  }

  assertNoActiveStages(): void {
    if (this.#active.size > 0) {
      throw new Error(
        `Unfinished performance stages: ${[...this.#active.keys()].join(", ")}`,
      );
    }
  }
}
