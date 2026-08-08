import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiagnosticsSheet } from "../diagnostics-sheet";

vi.mock("../components/diagnostics-body", () => {
  throw new Error("chunk failed");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DiagnosticsSheet lazy-load error", () => {
  it("contains a rejected diagnostics chunk inside the sheet", async () => {
    render(<DiagnosticsSheet logs={[]} />);

    fireEvent.click(screen.getByTestId("diagnostics-trigger-desktop"));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Diagnostics could not be opened",
      );
    });
  });
});
