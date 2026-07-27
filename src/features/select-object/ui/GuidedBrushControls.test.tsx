import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendGuidedBrushStroke,
  createGuidedBrushSession,
  createGuidedBrushViewSession,
} from "../model/guided-brush-session";
import { GuidedBrushControls } from "./GuidedBrushControls";

const source = {
  blob: new Blob(["image"], { type: "image/png" }),
  width: 200,
  height: 100,
  format: "image/png" as const,
};
const matte = {
  width: 200,
  height: 100,
  data: new Uint8ClampedArray(20_000).fill(255),
};

afterEach(cleanup);

function renderControls(
  session = createGuidedBrushViewSession(createGuidedBrushSession(source, matte)),
  overrides: Partial<Parameters<typeof GuidedBrushControls>[0]> = {},
) {
  const callbacks = {
    onModeChange: vi.fn(),
    onBrushRadiusChange: vi.fn(),
    onBrushSizeInteraction: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onClear: vi.fn(),
    onApply: vi.fn(),
    onCancel: vi.fn(),
  };
  render(
    <GuidedBrushControls
      {...callbacks}
      mode="keep"
      session={session}
      status={session.status}
      canApply={false}
      {...overrides}
    />,
  );
  return callbacks;
}

describe("GuidedBrushControls", () => {
  it("maps Magic to Keep/Remove and keeps Apply disabled without a visible change", () => {
    renderControls();
    expect(screen.getByRole("button", { name: "Keep" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Apply" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.queryByText(/candidate|result \d|stroke.*limit|model/i)).toBeNull();
  });

  it("uses icon-labelled history actions and reports keyboard slider changes", () => {
    const session = createGuidedBrushViewSession(
      appendGuidedBrushStroke(createGuidedBrushSession(source, matte), {
        id: "stroke",
        mode: "remove",
        points: [{ x: 0.5, y: 0.5 }],
        radius: 12,
      }),
    );
    const callbacks = renderControls(session, {
      mode: "remove",
      status: "dirty",
      canApply: true,
    });
    const slider = screen.getByRole("slider", { name: /guided brush size/i });
    fireEvent.input(slider, { target: { value: "20" } });
    expect(callbacks.onBrushRadiusChange).toHaveBeenCalledWith(20);
    expect(callbacks.onBrushSizeInteraction).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Undo marking" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear markings" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(callbacks.onUndo).toHaveBeenCalledTimes(1);
    expect(callbacks.onClear).toHaveBeenCalledTimes(1);
    expect(callbacks.onApply).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Undo marking" }).textContent).toBe("");
  });

  it("keeps the green intent requirement for a base-less draft", () => {
    const session = createGuidedBrushViewSession(
      appendGuidedBrushStroke(createGuidedBrushSession(source), {
        id: "remove",
        mode: "remove",
        points: [{ x: 0.5, y: 0.5 }],
        radius: 3,
      }),
    );
    renderControls(session, {
      mode: "remove",
      status: "dirty",
      canApply: false,
    });
    expect(screen.getByText(/green Keep marking/i)).toBeDefined();
  });
});
