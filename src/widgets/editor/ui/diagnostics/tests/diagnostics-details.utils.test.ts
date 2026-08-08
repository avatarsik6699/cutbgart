import { describe, expect, it } from "vitest";

import { hasDiagnosticsDetails } from "../diagnostics-details.utils";

describe("hasDiagnosticsDetails", () => {
  it("keeps the empty state until an observable diagnostic signal exists", () => {
    expect(hasDiagnosticsDetails({ logs: [] })).toBe(false);
    expect(
      hasDiagnosticsDetails({
        logs: [],
        modelLoadBytes: { loaded: 0, total: 1024 },
        runInfo: null,
      }),
    ).toBe(false);
  });

  it.each([
    { logs: [{ id: "ready", message: "ready", timestamp: 1 }] },
    { logs: [], runInfo: { dtype: "q8", inferencePath: "wasm" } },
    { logs: [], modelLoadBytes: { loaded: 1, total: null } },
    { logs: [], lightweightMode: true },
    { logs: [], fallbackUsed: true },
  ])("recognizes a bounded diagnostic signal", (props) => {
    expect(hasDiagnosticsDetails(props)).toBe(true);
  });
});
