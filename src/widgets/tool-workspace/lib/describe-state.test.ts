import { describe, expect, it } from "vitest";

import { describeGuidedState } from "./describe-state";

describe("describeGuidedState", () => {
  // PHASE_31 T8 full-inventory finding: the worker-reported download/encode
  // percentage was received but discarded (`void progress`), making the
  // first-time SlimSAM model download indistinguishable from a hang.
  it("includes the real percentage while loading the model, not a static message", () => {
    expect(describeGuidedState("loading-model", 42)).toMatch(/42/);
    expect(describeGuidedState("encoding-image", 7)).toMatch(/7/);
  });

  it("falls back to the static message before any progress is reported", () => {
    expect(describeGuidedState("loading-model", null)).not.toMatch(/\d/);
  });
});
