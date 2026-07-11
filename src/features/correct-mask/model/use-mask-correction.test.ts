import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MaskPatch } from "../../../entities/processed-image";
import type { MaskCanvasHandle } from "../ui/MaskCorrectionCanvas";
import { useMaskCorrection } from "./use-mask-correction";

function makePatch(beforeFill: number, afterFill: number): MaskPatch {
  const box = { minX: 0, maxX: 1, minY: 0, maxY: 0 };
  return {
    box,
    before: new Uint8ClampedArray(2).fill(beforeFill),
    after: new Uint8ClampedArray(2).fill(afterFill),
  };
}

function makeCanvasRef() {
  const handle: MaskCanvasHandle = {
    applyPatch: vi.fn(),
    extractMatte: vi.fn(() => null),
  };
  return { ref: { current: handle }, handle };
}

const imageSize = { width: 100, height: 50 };

describe("useMaskCorrection", () => {
  it("starts with no undo/redo history", () => {
    const { ref } = makeCanvasRef();
    const { result } = renderHook(() => useMaskCorrection(ref, imageSize));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.zoomPercent).toBe(100);
    expect(result.current.canPan).toBe(false);
  });

  it("commitStroke records the patch and enables undo without touching the canvas", () => {
    const { ref, handle } = makeCanvasRef();
    const { result } = renderHook(() => useMaskCorrection(ref, imageSize));

    act(() => {
      result.current.commitStroke(makePatch(0, 255));
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    // The canvas already shows the stroke it just painted — commit must not
    // write anything back.
    expect(handle.applyPatch).not.toHaveBeenCalled();
  });

  it("undo writes the patch's before-region to the canvas as a single step, redo writes the after-region", () => {
    const { ref, handle } = makeCanvasRef();
    const { result } = renderHook(() => useMaskCorrection(ref, imageSize));
    const patch = makePatch(0, 255);

    act(() => {
      result.current.commitStroke(patch);
    });

    act(() => {
      result.current.undo();
    });
    expect(handle.applyPatch).toHaveBeenCalledTimes(1);
    expect(handle.applyPatch).toHaveBeenLastCalledWith(patch.box, patch.before);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });
    expect(handle.applyPatch).toHaveBeenCalledTimes(2);
    expect(handle.applyPatch).toHaveBeenLastCalledWith(patch.box, patch.after);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("a new commit after undo clears the redo stack", () => {
    const { ref } = makeCanvasRef();
    const { result } = renderHook(() => useMaskCorrection(ref, imageSize));

    act(() => {
      result.current.commitStroke(makePatch(0, 100));
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.commitStroke(makePatch(0, 200));
    });
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it("multiple commits each push their own undo step, undone in reverse order", () => {
    const { ref, handle } = makeCanvasRef();
    const { result } = renderHook(() => useMaskCorrection(ref, imageSize));
    const first = makePatch(0, 100);
    const second = makePatch(100, 200);

    act(() => {
      result.current.commitStroke(first);
    });
    act(() => {
      result.current.commitStroke(second);
    });

    act(() => {
      result.current.undo();
    });
    expect(handle.applyPatch).toHaveBeenLastCalledWith(second.box, second.before);

    act(() => {
      result.current.undo();
    });
    expect(handle.applyPatch).toHaveBeenLastCalledWith(first.box, first.before);
    expect(result.current.canUndo).toBe(false);
  });

  it("undo/redo are no-ops when there's no history", () => {
    const { ref, handle } = makeCanvasRef();
    const { result } = renderHook(() => useMaskCorrection(ref, imageSize));

    act(() => {
      result.current.undo();
      result.current.redo();
    });

    expect(handle.applyPatch).not.toHaveBeenCalled();
  });

  it("survives the canvas handle being unset (before decode / after unmount)", () => {
    const ref = { current: null };
    const { result } = renderHook(() => useMaskCorrection(ref, imageSize));

    act(() => {
      result.current.commitStroke(makePatch(0, 255));
    });
    act(() => {
      result.current.undo();
    });

    // No throw — and history bookkeeping still advanced.
    expect(result.current.canRedo).toBe(true);
  });

  it("zooms around the image center and clamps pan to the visible source bounds", () => {
    const { ref } = makeCanvasRef();
    const { result } = renderHook(() => useMaskCorrection(ref, imageSize));

    act(() => {
      result.current.zoomIn();
    });

    expect(result.current.zoomPercent).toBe(125);
    expect(result.current.viewport.offsetX).toBeCloseTo(10);
    expect(result.current.viewport.offsetY).toBeCloseTo(5);
    expect(result.current.canPan).toBe(true);
    expect(result.current.zoomAnnouncement).toBe("Mask editor zoom 125%");

    act(() => {
      result.current.panView(1, 1);
      result.current.panView(1, 1);
      result.current.panView(1, 1);
    });

    expect(result.current.viewport.offsetX).toBeCloseTo(20);
    expect(result.current.viewport.offsetY).toBeCloseTo(10);
  });

  it("resetView returns to 100% zoom and clears pan", () => {
    const { ref } = makeCanvasRef();
    const { result } = renderHook(() => useMaskCorrection(ref, imageSize));

    act(() => {
      result.current.zoomIn();
      result.current.panView(1, 1);
      result.current.resetView();
    });

    expect(result.current.viewport).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
    expect(result.current.canZoomOut).toBe(false);
    expect(result.current.canPan).toBe(false);
  });

  it("zooms around a supplied source-pixel anchor and pans by exact source pixels", () => {
    const { ref } = makeCanvasRef();
    const { result } = renderHook(() => useMaskCorrection(ref, imageSize));

    act(() => {
      result.current.zoomIn({ x: 80, y: 40 });
    });

    expect(result.current.zoomPercent).toBe(125);
    expect(result.current.viewport.offsetX).toBeCloseTo(16);
    expect(result.current.viewport.offsetY).toBeCloseTo(8);

    act(() => {
      result.current.zoomByWheel(-100, { x: 80, y: 40 });
      result.current.panBySourcePixels(3, 4);
    });

    expect(result.current.zoomPercent).toBe(140);
    expect(result.current.viewport.offsetX).toBeCloseTo(25.857, 2);
    expect(result.current.viewport.offsetY).toBeCloseTo(14.285, 2);
  });
});
