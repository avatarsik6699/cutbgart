import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PROCESSING_EXPLANATION_DELAY_MS } from "./delayed-processing-explanation";
import { ProcessingStatus } from "./processing-status";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ProcessingStatus", () => {
  it("reveals the localized explanation only after the deterministic threshold", async () => {
    vi.useFakeTimers();
    const view = render(
      <ProcessingStatus fallbackUsed={false} processing statusText="Processing" />,
    );

    await act(() => vi.advanceTimersByTimeAsync(PROCESSING_EXPLANATION_DELAY_MS - 1));
    expect(screen.queryByTestId("delayed-processing-explanation")).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByTestId("delayed-processing-explanation")).toBeTruthy();

    view.rerender(
      <ProcessingStatus fallbackUsed={false} processing={false} statusText="Done" />,
    );
    expect(screen.queryByTestId("delayed-processing-explanation")).toBeNull();
    view.rerender(
      <ProcessingStatus fallbackUsed={false} processing statusText="Processing again" />,
    );
    expect(screen.queryByTestId("delayed-processing-explanation")).toBeNull();
  });
});
