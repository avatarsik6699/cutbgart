import { useCallback, useState, type RefObject } from "react";

import type { BrushMode, MaskPatch } from "../../../entities/processed-image";
import type { MaskCanvasHandle } from "../ui/MaskCorrectionCanvas";

// Bounds undo/redo memory — each entry is a patch sized by its stroke's
// bounding box, so even the cap is cheap; it exists to keep pathological
// whole-canvas strokes from accumulating without bound.
const MAX_HISTORY = 20;
const DEFAULT_BRUSH_RADIUS = 24;
const DEFAULT_BRUSH_HARDNESS = 0.5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const WHEEL_ZOOM_FACTOR = 1.12;

export interface MaskCorrectionViewport {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface MaskCorrectionImageSize {
  width: number;
  height: number;
}

export interface MaskCorrectionViewportPoint {
  x: number;
  y: number;
}

const DEFAULT_VIEWPORT: MaskCorrectionViewport = {
  zoom: MIN_ZOOM,
  offsetX: 0,
  offsetY: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function maxPan(dimension: number, zoom: number): number {
  return Math.max(0, dimension - dimension / zoom);
}

function clampViewport(
  viewport: MaskCorrectionViewport,
  imageSize: MaskCorrectionImageSize,
): MaskCorrectionViewport {
  const zoom = clamp(viewport.zoom, MIN_ZOOM, MAX_ZOOM);
  return {
    zoom,
    offsetX: clamp(viewport.offsetX, 0, maxPan(imageSize.width, zoom)),
    offsetY: clamp(viewport.offsetY, 0, maxPan(imageSize.height, zoom)),
  };
}

function zoomAroundPoint(
  viewport: MaskCorrectionViewport,
  imageSize: MaskCorrectionImageSize,
  nextZoom: number,
  anchor: MaskCorrectionViewportPoint,
): MaskCorrectionViewport {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const safeAnchor = {
    x: clamp(anchor.x, 0, imageSize.width),
    y: clamp(anchor.y, 0, imageSize.height),
  };
  const viewportRatioX =
    imageSize.width <= 0
      ? 0.5
      : clamp(
          (safeAnchor.x - viewport.offsetX) / (imageSize.width / viewport.zoom),
          0,
          1,
        );
  const viewportRatioY =
    imageSize.height <= 0
      ? 0.5
      : clamp(
          (safeAnchor.y - viewport.offsetY) / (imageSize.height / viewport.zoom),
          0,
          1,
        );
  return clampViewport(
    {
      zoom,
      offsetX: safeAnchor.x - (imageSize.width / zoom) * viewportRatioX,
      offsetY: safeAnchor.y - (imageSize.height / zoom) * viewportRatioY,
    },
    imageSize,
  );
}

function centerPoint(
  viewport: MaskCorrectionViewport,
  imageSize: MaskCorrectionImageSize,
): MaskCorrectionViewportPoint {
  return {
    x: viewport.offsetX + imageSize.width / viewport.zoom / 2,
    y: viewport.offsetY + imageSize.height / viewport.zoom / 2,
  };
}

export interface UseMaskCorrectionResult {
  mode: BrushMode;
  setMode: (mode: BrushMode) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushHardness: number;
  setBrushHardness: (hardness: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  viewport: MaskCorrectionViewport;
  zoomPercent: number;
  zoomAnnouncement: string;
  canZoomIn: boolean;
  canZoomOut: boolean;
  canPan: boolean;
  zoomIn: (anchor?: MaskCorrectionViewportPoint) => void;
  zoomOut: (anchor?: MaskCorrectionViewportPoint) => void;
  zoomByWheel: (deltaY: number, anchor: MaskCorrectionViewportPoint) => void;
  resetView: () => void;
  panView: (deltaX: number, deltaY: number, speed?: "normal" | "fast") => void;
  panBySourcePixels: (deltaX: number, deltaY: number) => void;
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
  imageSize: MaskCorrectionImageSize,
): UseMaskCorrectionResult {
  const imageWidth = imageSize.width;
  const imageHeight = imageSize.height;
  const [mode, setMode] = useState<BrushMode>("add");
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_RADIUS);
  const [brushHardness, setBrushHardness] = useState(DEFAULT_BRUSH_HARDNESS);
  const [undoStack, setUndoStack] = useState<MaskPatch[]>([]);
  const [redoStack, setRedoStack] = useState<MaskPatch[]>([]);
  const [viewport, setViewport] = useState<MaskCorrectionViewport>(DEFAULT_VIEWPORT);
  const safeViewport = clampViewport(viewport, {
    width: imageWidth,
    height: imageHeight,
  });

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

  const zoomIn = useCallback(
    (anchor?: MaskCorrectionViewportPoint) => {
      setViewport((current) => {
        const dimensions = { width: imageWidth, height: imageHeight };
        const safeCurrent = clampViewport(current, dimensions);
        return zoomAroundPoint(
          safeCurrent,
          dimensions,
          safeCurrent.zoom + ZOOM_STEP,
          anchor ?? centerPoint(safeCurrent, dimensions),
        );
      });
    },
    [imageWidth, imageHeight],
  );

  const zoomOut = useCallback(
    (anchor?: MaskCorrectionViewportPoint) => {
      setViewport((current) => {
        const dimensions = { width: imageWidth, height: imageHeight };
        const safeCurrent = clampViewport(current, dimensions);
        return zoomAroundPoint(
          safeCurrent,
          dimensions,
          safeCurrent.zoom - ZOOM_STEP,
          anchor ?? centerPoint(safeCurrent, dimensions),
        );
      });
    },
    [imageWidth, imageHeight],
  );

  const zoomByWheel = useCallback(
    (deltaY: number, anchor: MaskCorrectionViewportPoint) => {
      setViewport((current) => {
        const dimensions = { width: imageWidth, height: imageHeight };
        const safeCurrent = clampViewport(current, dimensions);
        const factor = deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
        return zoomAroundPoint(
          safeCurrent,
          dimensions,
          safeCurrent.zoom * factor,
          anchor,
        );
      });
    },
    [imageWidth, imageHeight],
  );

  const resetView = useCallback(() => {
    setViewport(DEFAULT_VIEWPORT);
  }, []);

  const panView = useCallback(
    (deltaX: number, deltaY: number, speed: "normal" | "fast" = "normal") => {
      setViewport((current) => {
        const dimensions = { width: imageWidth, height: imageHeight };
        const safeCurrent = clampViewport(current, dimensions);
        const visibleWidth = imageWidth / safeCurrent.zoom;
        const visibleHeight = imageHeight / safeCurrent.zoom;
        const multiplier = speed === "fast" ? 0.75 : 0.25;
        return clampViewport(
          {
            zoom: safeCurrent.zoom,
            offsetX: safeCurrent.offsetX + deltaX * visibleWidth * multiplier,
            offsetY: safeCurrent.offsetY + deltaY * visibleHeight * multiplier,
          },
          dimensions,
        );
      });
    },
    [imageWidth, imageHeight],
  );

  const panBySourcePixels = useCallback(
    (deltaX: number, deltaY: number) => {
      setViewport((current) =>
        clampViewport(
          {
            zoom: current.zoom,
            offsetX: current.offsetX + deltaX,
            offsetY: current.offsetY + deltaY,
          },
          { width: imageWidth, height: imageHeight },
        ),
      );
    },
    [imageWidth, imageHeight],
  );

  const zoomPercent = Math.round(safeViewport.zoom * 100);

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
    viewport: safeViewport,
    zoomPercent,
    zoomAnnouncement: `Mask editor zoom ${String(zoomPercent)}%`,
    canZoomIn: safeViewport.zoom < MAX_ZOOM,
    canZoomOut: safeViewport.zoom > MIN_ZOOM,
    canPan: safeViewport.zoom > MIN_ZOOM,
    zoomIn,
    zoomOut,
    zoomByWheel,
    resetView,
    panView,
    panBySourcePixels,
  };
}
