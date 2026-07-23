import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendGuidedBrushStroke,
  createGuidedBrushSession,
  createGuidedBrushViewSession,
  setGuidedBrushCandidates,
} from "../model/guided-brush-session";
import { GuidedBrushControls } from "./GuidedBrushControls";

const source = {
  blob: new Blob(["image"], { type: "image/png" }),
  width: 20,
  height: 10,
  format: "image/png" as const,
};
const matte = {
  width: 20,
  height: 10,
  data: new Uint8ClampedArray(200).fill(255),
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const callbacks = {
  onModeChange: vi.fn(),
  onBrushRadiusChange: vi.fn(),
  onSelectCandidate: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onClear: vi.fn(),
  onRecompute: vi.fn(),
  onContinueFromResult: vi.fn(),
  onAccept: vi.fn(),
  onRetry: vi.fn(),
  onCancel: vi.fn(),
};

describe("GuidedBrushControls", () => {
  it("uses labelled keep/remove modes and blocks red-only direct recompute", () => {
    const session = createGuidedBrushViewSession(
      appendGuidedBrushStroke(createGuidedBrushSession(source), {
        id: "remove",
        mode: "remove",
        points: [{ x: 0.5, y: 0.5 }],
        radius: 3,
      }),
    );
    render(
      <GuidedBrushControls
        {...callbacks}
        mode="remove"
        session={session}
        status="dirty"
        canAccept={false}
      />,
    );
    expect(screen.getByRole("toolbar", { name: /semantic brush mode/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /keep/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /remove/i })).toBeDefined();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /recompute mask/i }).disabled,
    ).toBe(true);
    expect(screen.getByText(/at least one green keep marking/i)).toBeDefined();
    fireEvent.change(screen.getByRole("slider", { name: /guided brush size/i }), {
      target: { value: "7" },
    });
    expect(callbacks.onBrushRadiusChange).toHaveBeenCalledWith(7);
    const halo = screen.getByTestId("guided-brush-size-swatch");
    const core = screen.getByTestId("guided-brush-core-size-swatch");
    expect(halo.style.width).toBe(halo.style.height);
    expect(core.style.width).toBe(core.style.height);
    expect(Number.parseInt(core.style.width)).toBeLessThan(
      Number.parseInt(halo.style.width),
    );
    expect(screen.getByTestId("guided-brush-tolerance-hint").textContent).toMatch(
      /inner core.*firm.*outer halo.*tolerance/i,
    );
    expect(screen.getByTestId("guided-brush-limits").textContent).toMatch(
      /1 of 50 strokes.*512.*32/i,
    );
  });

  it("automatically presents the best result and navigates described alternatives", () => {
    const painted = appendGuidedBrushStroke(createGuidedBrushSession(source, matte), {
      id: "keep",
      mode: "keep",
      points: [{ x: 0.5, y: 0.5 }],
      radius: 2,
    });
    const session = createGuidedBrushViewSession(
      setGuidedBrushCandidates(
        painted,
        [
          {
            id: "best",
            matte,
            modelRankScore: 7.4,
            intentScore: 1,
            differenceRatio: 0,
            foregroundRatio: 0.75,
          },
          {
            id: "other",
            matte: { ...matte, data: new Uint8ClampedArray(200) },
            modelRankScore: null,
            intentScore: 0.5,
            differenceRatio: 1,
            foregroundRatio: 0.25,
          },
        ],
        { x: 0, y: 0, width: 20, height: 10 },
      ),
    );
    const { rerender } = render(
      <GuidedBrushControls
        {...callbacks}
        mode="keep"
        session={session}
        status="preview"
        canAccept
      />,
    );
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(
      screen.getByTestId("guided-brush-candidates").getAttribute("data-candidate-count"),
    ).toBe("2");
    expect(screen.getByText(/automatically selected.*best match/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /continue from this result/i }),
    ).toBeDefined();
    expect(screen.queryByText(/score|estimate unavailable|7\.4|%/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /next result/i }));
    expect(callbacks.onSelectCandidate).toHaveBeenCalledWith("other");
    rerender(
      <GuidedBrushControls
        {...callbacks}
        mode="keep"
        session={{ ...session, selectedCandidateId: "other" }}
        status="preview"
        canAccept
      />,
    );
    expect(screen.getByText(/tighter contour.*keeps less/i)).toBeDefined();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /previous result/i })
        .disabled,
    ).toBe(false);
  });

  it("explains collapsed alternatives instead of rendering redundant controls", () => {
    const session = createGuidedBrushViewSession(
      setGuidedBrushCandidates(
        appendGuidedBrushStroke(createGuidedBrushSession(source, matte), {
          id: "keep",
          mode: "keep",
          points: [{ x: 0.5, y: 0.5 }],
          radius: 2,
        }),
        [
          {
            id: "only",
            matte,
            modelRankScore: null,
            intentScore: 1,
            differenceRatio: 0,
            foregroundRatio: 0.5,
          },
        ],
        { x: 0, y: 0, width: 20, height: 10 },
      ),
    );
    render(
      <GuidedBrushControls
        {...callbacks}
        mode="keep"
        session={session}
        status="preview"
        canAccept
      />,
    );
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(/materially identical/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /next result/i })).toBeNull();
  });
});
