import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDocumentId,
  createMagicCandidateId,
  createMagicDraftId,
  type MagicCutoutDraft,
} from "@/v2/domain";
import {
  MagicCutoutWorkspace,
  type MagicCutoutInteraction,
} from "./magic-cutout-workspace";

const candidateId = createMagicCandidateId("candidate-1");
const draft: MagicCutoutDraft = {
  kind: "magic-cutout",
  documentId: createDocumentId("document-1"),
  draftId: createMagicDraftId("draft-1"),
  baselineRevision: 0,
  draftRevision: 1,
  dirty: true,
  status: "preview",
  selectedCandidateId: candidateId,
};

function sessionHarness() {
  const calls = {
    apply: vi.fn(),
    cancel: vi.fn(),
    predict: vi.fn(),
    redo: vi.fn(),
    select: vi.fn(),
    undo: vi.fn(),
  };
  const interaction = {
    apply: calls.apply,
    appendPoint: vi.fn(),
    beginStroke: vi.fn(() => true),
    cancel: calls.cancel,
    cancelStroke: vi.fn(),
    commitStroke: vi.fn(() => true),
    displayStrokes: () => [],
    paintCandidate: vi.fn(),
    predict: calls.predict,
    readViewState: () => ({ mode: "keep" as const, radius: 18 }),
    redo: calls.redo,
    selectCandidate: calls.select,
    snapshot: () => ({ strokeCount: 1, canUndo: true, canRedo: true }),
    undo: calls.undo,
    writeViewState: vi.fn(),
  } as unknown as MagicCutoutInteraction;
  return { calls, interaction };
}

describe("MagicCutoutWorkspace", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      arc: vi.fn(),
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  it("keeps prediction, candidate selection, Apply, and dirty Cancel explicit", () => {
    const harness = sessionHarness();
    render(
      <MagicCutoutWorkspace
        candidates={[{ candidateId, score: 0.9 }]}
        draft={draft}
        height={10}
        runtimeProgress={null}
        interaction={harness.interaction}
        sourceUrl="blob:source"
        width={10}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Predict|Предсказать/ }));
    fireEvent.click(screen.getByRole("button", { name: /Candidate 1|Вариант 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Apply$|^Применить$/ }));
    expect(harness.calls.predict).toHaveBeenCalledOnce();
    expect(harness.calls.select).toHaveBeenCalledWith(candidateId);
    expect(harness.calls.apply).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: /^Cancel$|^Отменить$/ }));
    const dialog = screen.getByRole("alertdialog");
    const continueButton = screen.getByRole("button", {
      name: /Continue editing|Продолжить редактирование/,
    });
    expect(document.activeElement).toBe(continueButton);
    expect(harness.calls.cancel).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Cancel$|^Отменить$/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$|^Отменить$/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Discard draft|Отбросить черновик/ }),
    );
    expect(harness.calls.cancel).toHaveBeenCalledOnce();
  });

  it("routes Magic-local keyboard undo and redo", () => {
    const harness = sessionHarness();
    render(
      <MagicCutoutWorkspace
        candidates={[]}
        draft={{ ...draft, status: "dirty", selectedCandidateId: null }}
        height={10}
        runtimeProgress={null}
        interaction={harness.interaction}
        sourceUrl="blob:source"
        width={10}
      />,
    );

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(harness.calls.undo).toHaveBeenCalledOnce();
    expect(harness.calls.redo).toHaveBeenCalledOnce();
  });
});
