import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DiagnosticsSheet } from "../diagnostics-sheet";

afterEach(cleanup);

describe("DiagnosticsSheet", () => {
  it("shows a useful empty state after opening before processing starts", async () => {
    render(<DiagnosticsSheet logs={[]} />);

    fireEvent.click(screen.getByTestId("diagnostics-trigger-desktop"));
    await waitFor(() => {
      expect(screen.getByText(/no diagnostic data yet/i)).toBeDefined();
    });
  });

  it("keeps technical details out of layout until explicitly opened", async () => {
    render(
      <DiagnosticsSheet
        logs={[{ id: "worker-ready", timestamp: 1, message: "worker ready" }]}
        runInfo={{ inferencePath: "wasm", dtype: "q8" }}
      />,
    );

    expect(screen.queryByTestId("processing-details")).toBeNull();
    fireEvent.click(screen.getByTestId("diagnostics-trigger-desktop"));
    await waitFor(() => expect(screen.getByTestId("processing-details")).toBeDefined());
    expect(screen.getByTestId("processing-details").textContent).toContain(
      "worker ready",
    );
  });
});
