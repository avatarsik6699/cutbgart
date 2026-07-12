import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { m } from "@/paraglide/messages";

import {
  extractAlphaRegion,
  interpolateStrokePoints,
  stampBrushAlphaInPlace,
  unionBoundingBox,
  writeAlphaRegion,
  type AlphaMatte,
  type BackgroundFill,
  type BrushBoundingBox,
  type BrushMode,
  type MaskPatch,
  type SourceImage,
} from "../../../entities/processed-image";
import type {
  MaskCorrectionViewport,
  MaskCorrectionViewportPoint,
} from "../model/use-mask-correction";

// Distinct tint per mode so the brush cursor also answers "what will this
// stroke actually do" at a glance (Phase 07 Architect Review Notes R2) —
// green reads as "keep/add", red as "remove", blue as a neutral "reset".
const MODE_CURSOR_COLOR: Record<BrushMode, string> = {
  add: "34, 197, 94",
  erase: "239, 68, 68",
  restore: "59, 130, 246",
};

interface CanvasGeometry {
  canvasRect: DOMRect;
  viewportRect: DOMRect;
  scaleX: number;
  scaleY: number;
  cssPixelsPerSourcePixel: number;
}

function overwriteAlphaChannel(rgba: Uint8ClampedArray, matte: AlphaMatte): void {
  const pixelCount = matte.width * matte.height;
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    rgba[pixel * 4 + 3] = matte.data[pixel] ?? 0;
  }
}

function extractAlphaChannel(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): AlphaMatte {
  const data = new Uint8ClampedArray(width * height);
  for (let pixel = 0; pixel < data.length; pixel++) {
    data[pixel] = rgba[pixel * 4 + 3] ?? 0;
  }
  return { width, height, data };
}

// Single-channel (alpha plane) counterparts of the entity's RGBA-buffer
// `extractAlphaRegion`/`writeAlphaRegion` — the committed baseline is stored
// as a bare width*height plane, not interleaved RGBA.
function readPlaneRegion(
  plane: Uint8ClampedArray,
  imageWidth: number,
  box: BrushBoundingBox,
): Uint8ClampedArray {
  const boxWidth = box.maxX - box.minX + 1;
  const boxHeight = box.maxY - box.minY + 1;
  const region = new Uint8ClampedArray(boxWidth * boxHeight);
  for (let y = 0; y < boxHeight; y++) {
    const rowStart = (box.minY + y) * imageWidth + box.minX;
    for (let x = 0; x < boxWidth; x++) {
      region[y * boxWidth + x] = plane[rowStart + x] ?? 0;
    }
  }
  return region;
}

function writePlaneRegion(
  plane: Uint8ClampedArray,
  imageWidth: number,
  box: BrushBoundingBox,
  region: Uint8ClampedArray,
): void {
  const boxWidth = box.maxX - box.minX + 1;
  for (let y = box.minY; y <= box.maxY; y++) {
    for (let x = box.minX; x <= box.maxX; x++) {
      plane[y * imageWidth + x] = region[(y - box.minY) * boxWidth + (x - box.minX)] ?? 0;
    }
  }
}

/**
 * Imperative surface for undo/redo and for reading the final result once —
 * deliberately a ref API rather than props. Routing the matte back through
 * props on every gesture is what caused Phase 07's ~1-2s pointer-up freeze:
 * React 19.2's dev-only Component Performance Track deep-diffs every changed
 * prop object, enumerating a megapixel `Uint8ClampedArray` element-by-element
 * (see docs/KNOWN_GOTCHAS.md). With this handle, no prop of this component
 * ever changes identity during editing.
 */
export interface MaskCanvasHandle {
  /**
   * Writes a patch region's alpha bytes into the live buffer (and the
   * committed baseline) and repaints only that rect — O(box). `alpha` is
   * `MaskPatch.before` for undo, `MaskPatch.after` for redo.
   */
  applyPatch: (box: BrushBoundingBox, alpha: Uint8ClampedArray) => void;
  /** Reads the full current matte out of the live buffer — call once, on Done. */
  extractMatte: () => AlphaMatte | null;
}

export interface MaskCorrectionCanvasProps {
  ref?: Ref<MaskCanvasHandle>;
  sourceImage: SourceImage;
  backgroundFill?: BackgroundFill;
  /**
   * Matte to seed the working buffer with — read once per `sourceImage`
   * decode, never re-read. Must be a stable object (the pristine
   * pre-correction matte); all later changes happen through gestures and
   * `applyPatch`, so this component's props never carry a changing buffer.
   */
  initialMatte: AlphaMatte;
  /** Pristine, pre-correction matte — `restore` mode's per-pixel target. */
  original: AlphaMatte;
  mode: BrushMode;
  /** Brush size, source-image pixels. */
  brushRadius: number;
  /** 0 (fully soft falloff) – 1 (hard edge). */
  brushHardness: number;
  /** View-only transform; brush math remains in source-image pixel space. */
  viewport: MaskCorrectionViewport;
  onZoomIn: (anchor?: MaskCorrectionViewportPoint) => void;
  onZoomOut: (anchor?: MaskCorrectionViewportPoint) => void;
  onWheelZoom: (deltaY: number, anchor: MaskCorrectionViewportPoint) => void;
  onResetView: () => void;
  onPan: (deltaX: number, deltaY: number, speed?: "normal" | "fast") => void;
  onPanBySourcePixels: (deltaX: number, deltaY: number) => void;
  /** Fires once per whole gesture (pointerdown → drag → pointerup), not per point. */
  onStrokeCommitted: (patch: MaskPatch) => void;
}

/**
 * Pointer-driven brush overlay (Phase 07, SPEC.md §5.2). Renders the source
 * image composited with the working alpha matte on a real `<canvas>`.
 *
 * Performance (Architect Review Notes R3/R4): during an active drag, brush
 * stamps mutate a persistent `ImageData` buffer in place and repaint only
 * the touched bounding box (`ctx.putImageData`'s dirty-rect overload) — not
 * the whole canvas. A gesture commits as a `MaskPatch` (dirty box + its
 * before/after alpha bytes, O(stroke area)) rather than a full matte
 * snapshot, so nothing O(image size) runs at pointer-up and no changing
 * multi-megabyte object ever crosses a React prop or state boundary.
 */
export function MaskCorrectionCanvas({
  ref,
  sourceImage,
  backgroundFill = { type: "transparent" },
  initialMatte,
  original,
  mode,
  brushRadius,
  brushHardness,
  viewport,
  onZoomIn,
  onZoomOut,
  onWheelZoom,
  onResetView,
  onPan,
  onPanBySourcePixels,
  onStrokeCommitted,
}: MaskCorrectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [pointerInside, setPointerInside] = useState(false);
  const [spacePanning, setSpacePanning] = useState(false);
  const [panning, setPanning] = useState(false);
  const spacePanningRef = useRef(false);
  // Persistent working buffer — source RGB, kept in sync with the current
  // alpha channel. Reused directly from `getImageData` (never reconstructed
  // via `new ImageData(...)`, which the DOM lib types reject for a plain
  // `Uint8ClampedArray` — see `features/remove-background/lib/compositing.ts`
  // for the same established pattern) and mutated in place by every brush
  // stamp during a drag.
  const rgbaRef = useRef<ImageData | null>(null);
  // Alpha channel as of the last committed gesture (or patch application) —
  // the baseline a `MaskPatch.before` is read from at pointer-up, and what
  // `pointercancel` reverts the live buffer to. Kept in lockstep with the
  // live buffer at every gesture boundary.
  const committedAlphaRef = useRef<Uint8ClampedArray | null>(null);
  const isPaintingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPaintPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastPanClientPointRef = useRef<{ x: number; y: number } | null>(null);
  const gestureGeometryRef = useRef<CanvasGeometry | null>(null);
  // Union of every stamp's bounding box in the current gesture — the commit
  // at pointer-up only reads/writes this rect.
  const gestureBoxRef = useRef<BrushBoundingBox | null>(null);
  // 2D context cached alongside the buffer instead of re-fetched on every
  // repaint call; created with `willReadFrequently` since this component
  // calls `getImageData`/`putImageData` continuously by design, which hints
  // the browser to keep the canvas CPU-backed rather than paying a GPU
  // readback stall on every call.
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const brushCursorVisible = pointerInside && !spacePanning && !panning;
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (backgroundFill.type !== "image") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears an externally-owned object URL when the selected fill stops being an image.
      setBackgroundImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(backgroundFill.blob);
    setBackgroundImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [backgroundFill]);

  const backgroundStyle =
    backgroundFill.type === "color"
      ? { backgroundColor: backgroundFill.value, backgroundImage: "none" }
      : backgroundFill.type === "gradient"
        ? {
            backgroundImage: `${backgroundFill.kind === "linear" ? "linear-gradient(to right" : "radial-gradient(circle at center"}, ${backgroundFill.stops[0].color}, ${backgroundFill.stops[1].color})`,
          }
        : backgroundFill.type === "image" && backgroundImageUrl
          ? {
              backgroundImage: `url("${backgroundImageUrl}")`,
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
            }
          : undefined;

  function repaintRect(box: BrushBoundingBox): void {
    const imageData = rgbaRef.current;
    const ctx = ctxRef.current;
    if (!ctx || !imageData) return;
    ctx.putImageData(
      imageData,
      0,
      0,
      box.minX,
      box.minY,
      box.maxX - box.minX + 1,
      box.maxY - box.minY + 1,
    );
  }

  function repaintAll(): void {
    const imageData = rgbaRef.current;
    const ctx = ctxRef.current;
    if (!ctx || !imageData) return;
    ctx.putImageData(imageData, 0, 0);
  }

  function readCanvasGeometry(): CanvasGeometry | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const canvasRect = canvas.getBoundingClientRect();
    const viewportRect = viewportRef.current?.getBoundingClientRect() ?? canvasRect;
    const scaleX = canvasRect.width === 0 ? 1 : canvas.width / canvasRect.width;
    const scaleY = canvasRect.height === 0 ? 1 : canvas.height / canvasRect.height;
    return {
      canvasRect,
      viewportRect,
      scaleX,
      scaleY,
      cssPixelsPerSourcePixel: canvas.width === 0 ? 1 : canvasRect.width / canvas.width,
    };
  }

  function currentGeometry(): CanvasGeometry | null {
    return gestureGeometryRef.current ?? readCanvasGeometry();
  }

  useEffect(() => {
    function refreshGestureGeometry(): void {
      if (!isPaintingRef.current) return;
      gestureGeometryRef.current = readCanvasGeometry();
    }

    window.addEventListener("resize", refreshGestureGeometry);
    window.addEventListener("scroll", refreshGestureGeometry, true);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", refreshGestureGeometry);
    viewport?.addEventListener("scroll", refreshGestureGeometry);

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(refreshGestureGeometry);
    const canvas = canvasRef.current;
    if (canvas) observer?.observe(canvas);

    return () => {
      window.removeEventListener("resize", refreshGestureGeometry);
      window.removeEventListener("scroll", refreshGestureGeometry, true);
      viewport?.removeEventListener("resize", refreshGestureGeometry);
      viewport?.removeEventListener("scroll", refreshGestureGeometry);
      observer?.disconnect();
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      applyPatch(box, alpha) {
        const imageData = rgbaRef.current;
        const committed = committedAlphaRef.current;
        const canvas = canvasRef.current;
        if (!imageData || !committed || !canvas) return;
        writeAlphaRegion(imageData.data, canvas.width, box, alpha);
        // Mirror into the committed baseline so the next gesture's `before`
        // reads post-undo/redo state, not a stale one.
        writePlaneRegion(committed, canvas.width, box, alpha);
        repaintRect(box);
      },
      extractMatte() {
        const imageData = rgbaRef.current;
        const canvas = canvasRef.current;
        if (!imageData || !canvas) return null;
        return extractAlphaChannel(imageData.data, canvas.width, canvas.height);
      },
    }),
    [],
  );

  // Decode the source image once per image and build the persistent working
  // buffer from it.
  useEffect(() => {
    let cancelled = false;
    rgbaRef.current = null;
    committedAlphaRef.current = null;
    ctxRef.current = null;

    void createImageBitmap(sourceImage.blob).then((bitmap) => {
      if (cancelled) {
        bitmap.close();
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      overwriteAlphaChannel(imageData.data, initialMatte);
      ctxRef.current = ctx;
      rgbaRef.current = imageData;
      committedAlphaRef.current = new Uint8ClampedArray(initialMatte.data);
      repaintAll();
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally excludes `initialMatte`: it is read exactly once per source decode by contract (see its prop doc); re-decoding on a matte change would defeat the persistent buffer.
  }, [sourceImage]);

  function toMattePoint(
    clientX: number,
    clientY: number,
    geometry: CanvasGeometry | null = currentGeometry(),
  ): { x: number; y: number } {
    if (!geometry) return { x: 0, y: 0 };
    return {
      x: (clientX - geometry.canvasRect.left) * geometry.scaleX,
      y: (clientY - geometry.canvasRect.top) * geometry.scaleY,
    };
  }

  function viewportCenterPoint(): MaskCorrectionViewportPoint {
    return {
      x: viewport.offsetX + sourceImage.width / viewport.zoom / 2,
      y: viewport.offsetY + sourceImage.height / viewport.zoom / 2,
    };
  }

  function stopPainting(): void {
    isPaintingRef.current = false;
    lastPaintPointRef.current = null;
    gestureGeometryRef.current = null;
    gestureBoxRef.current = null;
  }

  function stopPanning(): void {
    isPanningRef.current = false;
    setPanning(false);
    lastPanClientPointRef.current = null;
    gestureGeometryRef.current = null;
  }

  function commitPaintingGesture(): void {
    const canvas = canvasRef.current;
    const imageData = rgbaRef.current;
    const committed = committedAlphaRef.current;
    const box = gestureBoxRef.current;
    stopPainting();
    if (!canvas || !imageData || !committed || !box) return;
    const after = extractAlphaRegion(imageData.data, canvas.width, box);
    const before = readPlaneRegion(committed, canvas.width, box);
    writePlaneRegion(committed, canvas.width, box, after);
    onStrokeCommitted({ box, before, after });
  }

  function revertPaintingGesture(): void {
    const canvas = canvasRef.current;
    const imageData = rgbaRef.current;
    const committed = committedAlphaRef.current;
    const box = gestureBoxRef.current;
    stopPainting();
    if (!canvas || !imageData || !committed || !box) return;
    const baseline = readPlaneRegion(committed, canvas.width, box);
    writeAlphaRegion(imageData.data, canvas.width, box, baseline);
    repaintRect(box);
  }

  function handleKeyboardNavigation(event: globalThis.KeyboardEvent): void {
    const key = event.key;
    const modifierPressed = event.ctrlKey || event.metaKey;
    const center = viewportCenterPoint();
    const target = event.target;
    const editingText =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);

    if (key === " " && !editingText) {
      event.preventDefault();
      if (isPaintingRef.current) return;
      spacePanningRef.current = true;
      setSpacePanning(true);
      return;
    }

    if (modifierPressed && (key === "+" || key === "=")) {
      event.preventDefault();
      onZoomIn(center);
      return;
    }

    if (modifierPressed && key === "-") {
      event.preventDefault();
      onZoomOut(center);
      return;
    }

    if (modifierPressed && (key === "0" || key === "1")) {
      event.preventDefault();
      onResetView();
      return;
    }

    if (key.startsWith("Arrow") && !editingText) {
      event.preventDefault();
      const amount = event.shiftKey ? "fast" : "normal";
      if (key === "ArrowLeft") onPan(-1, 0, amount);
      if (key === "ArrowRight") onPan(1, 0, amount);
      if (key === "ArrowUp") onPan(0, -1, amount);
      if (key === "ArrowDown") onPan(0, 1, amount);
    }
  }

  function handleWheel(event: globalThis.WheelEvent): void {
    if (!rgbaRef.current) return;
    const geometry = readCanvasGeometry();
    if (!geometry) return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      onWheelZoom(event.deltaY, toMattePoint(event.clientX, event.clientY, geometry));
      return;
    }

    const lineHeight = 16;
    const pageSize = geometry.viewportRect.height;
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? lineHeight
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? pageSize
          : 1;
    const deltaX = event.deltaX * unit;
    const deltaY = event.deltaY * unit;

    if (event.shiftKey) {
      onPanBySourcePixels((deltaX || deltaY) * geometry.scaleX, 0);
      return;
    }

    onPanBySourcePixels(deltaX * geometry.scaleX, deltaY * geometry.scaleY);
  }

  useEffect(() => {
    const editor = viewportRef.current;
    if (!editor) return;

    function releaseHandTool(): void {
      spacePanningRef.current = false;
      setSpacePanning(false);
      if (isPanningRef.current) stopPanning();
    }

    function handleKeyUp(event: globalThis.KeyboardEvent): void {
      if (event.key !== " ") return;
      event.preventDefault();
      releaseHandTool();
    }

    // Capture shortcuts for the lifetime of the correction editor. This is
    // how desktop-style editors keep Cmd/Ctrl +/- from escaping to browser
    // page zoom after a toolbar button has taken focus.
    window.addEventListener("keydown", handleKeyboardNavigation, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", releaseHandTool);
    // React intentionally delegates wheel passively. The editor must be able
    // to prevent page scrolling, so this interaction surface owns a native
    // non-passive listener instead.
    editor.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyboardNavigation, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", releaseHandTool);
      editor.removeEventListener("wheel", handleWheel);
    };
  });

  function updateCursor(
    clientX: number,
    clientY: number,
    geometry: CanvasGeometry | null = currentGeometry(),
  ): void {
    const cursor = cursorRef.current;
    if (!geometry || !cursor) return;
    if (geometry.canvasRect.width === 0) return;
    // Inverse of `toMattePoint`'s scale — brush radius is in source-image
    // pixels, the cursor is drawn in on-screen CSS pixels.
    const cssRadius = brushRadius * geometry.cssPixelsPerSourcePixel;
    const cssDiameter = cssRadius * 2;
    cursor.style.left = `${String(clientX - geometry.viewportRect.left)}px`;
    cursor.style.top = `${String(clientY - geometry.viewportRect.top)}px`;
    cursor.style.width = `${String(cssDiameter)}px`;
    cursor.style.height = `${String(cssDiameter)}px`;
    // The hardness-flat zone (always-full-strength core) vs. the softer
    // falloff ring is shown as a lighter fill inset from the outer edge.
    const softInset = (1 - Math.min(Math.max(brushHardness, 0), 1)) * 50;
    cursor.style.setProperty("--mask-cursor-inset", `${String(softInset)}%`);
  }

  function stampAndRepaint(point: { x: number; y: number }): void {
    const imageData = rgbaRef.current;
    const canvas = canvasRef.current;
    if (!imageData || !canvas) return;
    const box = stampBrushAlphaInPlace(
      imageData.data,
      original.data,
      canvas.width,
      canvas.height,
      point,
      brushRadius,
      brushHardness,
      mode,
    );
    if (!box) return;
    gestureBoxRef.current = unionBoundingBox(gestureBoxRef.current, box);
    repaintRect(box);
  }

  function stampInterpolatedSegment(point: { x: number; y: number }): void {
    const previous = lastPaintPointRef.current;
    const points = previous
      ? interpolateStrokePoints([previous, point], brushRadius).slice(1)
      : [point];
    for (const interpolated of points) {
      stampAndRepaint(interpolated);
    }
    lastPaintPointRef.current = point;
  }

  return (
    <div
      ref={viewportRef}
      role="application"
      aria-label={m.maskEditor()}
      tabIndex={0}
      className="relative overflow-hidden rounded-xl bg-[length:16px_16px] bg-[image:repeating-conic-gradient(var(--color-border)_0%_25%,transparent_0%_50%)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={m.maskCanvas()}
        className="block w-full touch-none"
        style={{
          ...backgroundStyle,
          cursor: spacePanning || panning ? "grab" : "none",
          transform: `scale(${String(viewport.zoom)}) translate(${String(
            (-viewport.offsetX / sourceImage.width) * 100,
          )}%, ${String((-viewport.offsetY / sourceImage.height) * 100)}%)`,
          transformOrigin: "top left",
        }}
        onPointerEnter={(event) => {
          setPointerInside(true);
          updateCursor(event.clientX, event.clientY);
        }}
        onPointerLeave={() => {
          setPointerInside(false);
        }}
        onPointerDown={(event) => {
          if (!rgbaRef.current) return;
          const handGesture = spacePanningRef.current || event.button === 1;
          if (!handGesture && event.button !== 0) return;
          event.preventDefault();
          viewportRef.current?.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          gestureGeometryRef.current = readCanvasGeometry();
          if (handGesture) {
            isPanningRef.current = true;
            setPanning(true);
            lastPanClientPointRef.current = { x: event.clientX, y: event.clientY };
            return;
          }
          isPaintingRef.current = true;
          lastPaintPointRef.current = null;
          gestureBoxRef.current = null;
          const point = toMattePoint(
            event.clientX,
            event.clientY,
            gestureGeometryRef.current,
          );
          updateCursor(event.clientX, event.clientY, gestureGeometryRef.current);
          stampInterpolatedSegment(point);
        }}
        onPointerMove={(event) => {
          const geometry = currentGeometry();
          updateCursor(event.clientX, event.clientY, geometry);
          if (isPanningRef.current) {
            const previous = lastPanClientPointRef.current;
            if (!previous || !geometry) return;
            onPanBySourcePixels(
              (previous.x - event.clientX) * geometry.scaleX,
              (previous.y - event.clientY) * geometry.scaleY,
            );
            lastPanClientPointRef.current = { x: event.clientX, y: event.clientY };
            return;
          }
          if (!isPaintingRef.current) return;
          stampInterpolatedSegment(toMattePoint(event.clientX, event.clientY, geometry));
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          if (isPanningRef.current) {
            stopPanning();
            return;
          }
          if (!isPaintingRef.current) return;
          // A gesture that never touched a pixel (e.g. radius 0, or entirely
          // outside the image) commits nothing — no empty undo steps.
          commitPaintingGesture();
        }}
        onPointerCancel={() => {
          if (isPanningRef.current) {
            stopPanning();
            return;
          }
          if (!isPaintingRef.current) return;
          // Revert the aborted gesture's stamps so the canvas never shows
          // pixels that were never committed (previously they lingered).
          revertPaintingGesture();
        }}
        onAuxClick={(event) => {
          if (event.button === 1) event.preventDefault();
        }}
      />
      <div
        ref={cursorRef}
        aria-hidden="true"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity"
        style={{
          opacity: brushCursorVisible ? 1 : 0,
          border: `1.5px solid rgba(${MODE_CURSOR_COLOR[mode]}, 0.95)`,
          boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          className="absolute rounded-full"
          style={{
            inset: "var(--mask-cursor-inset, 0%)",
            background: `rgba(${MODE_CURSOR_COLOR[mode]}, 0.25)`,
          }}
        />
      </div>
    </div>
  );
}
