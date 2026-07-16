import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPromptSession } from "../model/prompt-session";
import { ObjectSelectionControls } from "./ObjectSelectionControls";

const source = {
  blob: new Blob(["image"], { type: "image/jpeg" }),
  width: 2,
  height: 2,
  format: "image/jpeg" as const,
};
const matte = { width: 2, height: 2, data: new Uint8ClampedArray([255, 0, 0, 0]) };

afterEach(cleanup);

function renderControls() {
  const first = createPromptSession(source, null, "one").layers[0]!;
  const session = {
    ...createPromptSession(source, null, "two"),
    activeLayerId: "two",
    layers: [
      { ...first, acceptedMatte: matte },
      {
        ...createPromptSession(source, null, "two").layers[0]!,
        candidates: [
          { id: "recommended", matte, score: null, differenceRatio: 0 },
          {
            id: "different",
            matte: { ...matte, data: new Uint8ClampedArray([0, 255, 0, 0]) },
            score: 0.75,
            differenceRatio: 0.5,
          },
        ],
        selectedCandidateId: "recommended",
        acceptedMatte: matte,
      },
    ],
  };
  const onRemoveLayer = vi.fn();
  const onResetLayer = vi.fn();
  const onSelectCandidate = vi.fn();
  render(
    <ObjectSelectionControls
      tool="positive"
      onToolChange={vi.fn()}
      session={session}
      status="preview"
      canAccept
      onAddLayer={vi.fn()}
      onSelectLayer={vi.fn()}
      onRemoveLayer={onRemoveLayer}
      onSelectCandidate={onSelectCandidate}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onResetLayer={onResetLayer}
      onAccept={vi.fn()}
      onRetry={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  return { onRemoveLayer, onResetLayer, onSelectCandidate };
}

describe("ObjectSelectionControls", () => {
  it("explains layers and distinguishes removal from clearing prompts", () => {
    const { onRemoveLayer, onResetLayer } = renderControls();
    expect(screen.getByText(/Each object|У каждого объекта/)).toBeDefined();
    expect(screen.getByText(/Editing|Редактируется/)).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", { name: /Remove object 2|Удалить объект 2/ }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Clear object prompts|Очистить ориентиры объекта/,
      }),
    );
    expect(onRemoveLayer).toHaveBeenCalledWith("two");
    expect(onResetLayer).toHaveBeenCalledOnce();
  });

  it("shows unavailable instead of NaN and describes candidate differences", () => {
    const { onSelectCandidate } = renderControls();
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(
      screen.getByText(/estimate unavailable|оценка качества SlimSAM недоступна/i),
    ).toBeDefined();
    expect(screen.getByText(/50% of pixels|50% пикселей/)).toBeDefined();
    fireEvent.click(screen.getByTestId("guided-candidate-2"));
    expect(onSelectCandidate).toHaveBeenCalledWith("different");
  });
});
