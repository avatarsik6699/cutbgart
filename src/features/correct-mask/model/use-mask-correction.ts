import { useCallback, useState, type RefObject } from "react";

import type { BrushMode, MaskPatch } from "../../../entities/processed-image";
import type { MaskCanvasHandle } from "../ui/MaskCorrectionCanvas";

// Bounds undo/redo memory — each entry is a patch sized by its stroke's
// bounding box, so even the cap is cheap; it exists to keep pathological
// whole-canvas strokes from accumulating without bound.
const MAX_HISTORY = 20;
const DEFAULT_BRUSH_RADIUS = 24;
const DEFAULT_BRUSH_HARDNESS = 0.5;

export interface UseMaskCorrectionResult {
  mode: BrushMode;
  setMode: (mode: BrushMode) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushHardness: number;
  setBrushHardness: (hardness: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * Records one whole gesture (pointerdown → drag → pointerup) as a single
   * undo step. The per-point brush math during the gesture itself happens
   * inside `MaskCorrectionCanvas` directly against its own live buffer (Phase
   * 07 Architect Review Notes R3) — this hook only sees the stroke's delta
   * patch, once per gesture, not once per pointer-move point.
   */
  commitStroke: (patch: MaskPatch) => void;
  undo: () => void;
  redo: () => void;
}

/**
 * Owns brush mode/size/hardness plus the patch-based undo/redo history
 * (Phase 07, SPEC.md §5.2). The working matte itself lives in
 * `MaskCorrectionCanvas`'s persistent buffer, reached through `canvas`
 * (undo/redo write patches back imperatively; "Done" reads the final matte
 * via `extractMatte`) — deliberately NOT through React state/props, since a
 * changing megapixel matte prop is what React 19.2's dev-mode Performance
 * Track chokes on for 1-2s per commit (Architect Review Notes R4,
 * docs/KNOWN_GOTCHAS.md).
 */
export function useMaskCorrection(
  canvas: RefObject<MaskCanvasHandle | null>,
): UseMaskCorrectionResult {
  const [mode, setMode] = useState<BrushMode>("add");
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_RADIUS);
  const [brushHardness, setBrushHardness] = useState(DEFAULT_BRUSH_HARDNESS);
  const [undoStack, setUndoStack] = useState<MaskPatch[]>([]);
  const [redoStack, setRedoStack] = useState<MaskPatch[]>([]);

  const commitStroke = useCallback((patch: MaskPatch) => {
    setUndoStack((stack) => [...stack, patch].slice(-MAX_HISTORY));
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    const patch = undoStack.at(-1);
    if (!patch) return;
    canvas.current?.applyPatch(patch.box, patch.before);
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, patch].slice(-MAX_HISTORY));
  }, [undoStack, canvas]);

  const redo = useCallback(() => {
    const patch = redoStack.at(-1);
    if (!patch) return;
    canvas.current?.applyPatch(patch.box, patch.after);
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, patch].slice(-MAX_HISTORY));
  }, [redoStack, canvas]);

  return {
    mode,
    setMode,
    brushSize,
    setBrushSize,
    brushHardness,
    setBrushHardness,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    commitStroke,
    undo,
    redo,
  };
}
