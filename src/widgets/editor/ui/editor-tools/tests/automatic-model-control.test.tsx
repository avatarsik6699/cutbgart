import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AutomaticModelControl } from "../automatic-model-control";

describe("AutomaticModelControl", () => {
  it("exposes only available models and emits a different keyboard-accessible choice", () => {
    const onSelect = vi.fn();
    render(
      <AutomaticModelControl
        availableModes={["isnet-q8", "isnet-fp32"]}
        busy={false}
        currentMode="isnet-q8"
        inferencePath="wasm"
        processingMode={null}
        onSelect={onSelect}
      />,
    );

    const control = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Current model: ISNet Fast",
    });
    expect(control.value).toBe("isnet-q8");
    expect(screen.queryByRole("option", { name: "BEN2 Maximum" })).toBeNull();
    fireEvent.change(control, { target: { value: "isnet-fp32" } });
    expect(onSelect).toHaveBeenCalledWith("isnet-fp32");
  });

  it("announces the active model, disables competing work, and restores focus", async () => {
    const onFocusRestored = vi.fn();
    const view = render(
      <AutomaticModelControl
        availableModes={["isnet-q8", "isnet-fp32", "ben2-fp16"]}
        busy
        currentMode="isnet-q8"
        inferencePath="webgpu"
        processingMode="ben2-fp16"
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByRole<HTMLSelectElement>("combobox", {
        name: "Processing with BEN2 Maximum",
      }).disabled,
    ).toBe(true);

    view.rerender(
      <AutomaticModelControl
        availableModes={["isnet-q8", "isnet-fp32", "ben2-fp16"]}
        busy={false}
        currentMode="ben2-fp16"
        inferencePath="webgpu"
        processingMode={null}
        restoreFocus
        onFocusRestored={onFocusRestored}
        onSelect={vi.fn()}
      />,
    );
    const restored = screen.getByRole("combobox", {
      name: "Current model: BEN2 Maximum",
    });
    await waitFor(() => expect(document.activeElement).toBe(restored));
    expect(onFocusRestored).toHaveBeenCalledOnce();
  });
});
