import { describe, expect, it } from "vitest";

import { planImageAdmission } from "./editor-policies";

describe("public editor presentation policies", () => {
  it.each([
    [0, 1, false, 0],
    [0, 2, true, 0],
    [19, 2, true, 1],
    [20, 3, true, 3],
  ] as const)(
    "plans admission from %s current and %s incoming files",
    (current, incoming, entersBatchMode, rejectedCount) => {
      expect(planImageAdmission(current, incoming)).toEqual({
        entersBatchMode,
        rejectedCount,
      });
    },
  );
});
