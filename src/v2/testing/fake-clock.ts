export type TestClock = {
  now(): number;
  advanceBy(durationMs: number): void;
  set(valueMs: number): void;
};

export function createFakeClock(initialMs = 0): TestClock {
  if (!Number.isFinite(initialMs)) throw new RangeError("Clock value must be finite");
  let currentMs = initialMs;
  return {
    now: () => currentMs,
    advanceBy(durationMs) {
      if (!Number.isFinite(durationMs) || durationMs < 0) {
        throw new RangeError("Clock advance must be a non-negative finite number");
      }
      currentMs += durationMs;
    },
    set(valueMs) {
      if (!Number.isFinite(valueMs)) throw new RangeError("Clock value must be finite");
      currentMs = valueMs;
    },
  };
}
