import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutomaticModelControl } from "../automatic-model-control";

afterEach(cleanup);

describe("AutomaticModelControl", () => {
  it("exposes only available models in the choice popover and reprocesses on the action button", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Current model: ISNet Fast" }));
    expect(screen.queryByRole("menuitemradio", { name: "BEN2 Maximum" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "ISNet Quality" }));
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Reprocess in ISNet Quality mode" }),
    );
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
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Processing with BEN2 Maximum",
      }).disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Reprocess in BEN2 Maximum mode",
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
    const restored = screen.getByRole("button", {
      name: "Current model: BEN2 Maximum",
    });
    await vi.waitFor(() => expect(document.activeElement).toBe(restored));
    expect(onFocusRestored).toHaveBeenCalledOnce();
  });
});
