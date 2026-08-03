import { describe, expect, it } from "vitest";

import { createNativeProcessingCancellationSource } from "./processing-cancellation";

describe("native processing cancellation", () => {
  it("creates isolated abort signals and aborts idempotently", () => {
    const source = createNativeProcessingCancellationSource();
    const first = source.create();
    const second = source.create();

    first.abort();
    first.abort();
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
  });
});
