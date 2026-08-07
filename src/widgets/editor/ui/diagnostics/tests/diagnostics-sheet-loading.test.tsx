import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiagnosticsSheet } from "../diagnostics-sheet";

const diagnosticsBodyModuleFactory = vi.hoisted(() =>
  vi.fn(() => new Promise(() => undefined)),
);

vi.mock("../components/diagnostics-body", diagnosticsBodyModuleFactory);

afterEach(cleanup);

describe("DiagnosticsSheet lazy loading", () => {
  it("loads the diagnostics chunk on open and shows a stable skeleton while pending", async () => {
    render(<DiagnosticsSheet logs={[]} />);

    expect(diagnosticsBodyModuleFactory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("diagnostics-trigger-desktop"));

    expect(screen.getByTestId("diagnostics-loading")).toBeDefined();
    expect(screen.getAllByTestId("diagnostics-loading")).toHaveLength(1);
    await waitFor(() => {
      expect(diagnosticsBodyModuleFactory).toHaveBeenCalledTimes(1);
    });
  });
});
