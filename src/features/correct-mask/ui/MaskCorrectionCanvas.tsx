import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

import {
  extractAlphaRegion,
  stampBrushAlphaInPlace,
  unionBoundingBox,
  writeAlphaRegion,
  type AlphaMatte,
  type BrushBoundingBox,
  type BrushMode,
  type MaskPatch,
  type SourceImage,
} from "../../../entities/processed-image";

// Distinct tint per mode so the brush cursor also answers "what will this
// stroke actually do" at a glance (Phase 07 Architect Review Notes R2) —
// green reads as "keep/add", red as "remove", blue as a neutral "reset".
const MODE_CURSOR_COLOR: Record<BrushMode, string> = {
  add: "34, 197, 94",
  erase: "239, 68, 68",
  restore: "59, 130, 246",
};

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
  initialMatte,
  original,
  mode,
  brushRadius,
  brushHardness,
  onStrokeCommitted,
}: MaskCorrectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
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
  // Union of every stamp's bounding box in the current gesture — the commit
  // at pointer-up only reads/writes this rect.
  const gestureBoxRef = useRef<BrushBoundingBox | null>(null);
  // 2D context cached alongside the buffer instead of re-fetched on every
  // repaint call; created with `willReadFrequently` since this component
  // calls `getImageData`/`putImageData` continuously by design, which hints
  // the browser to keep the canvas CPU-backed rather than paying a GPU
  // readback stall on every call.
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

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

  function toMattePoint(clientX: number, clientY: number): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width === 0 ? 1 : canvas.width / rect.width;
    const scaleY = rect.height === 0 ? 1 : canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function updateCursor(clientX: number, clientY: number): void {
    const canvas = canvasRef.current;
    const cursor = cursorRef.current;
    if (!canvas || !cursor) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    // Inverse of `toMattePoint`'s scale — brush radius is in source-image
    // pixels, the cursor is drawn in on-screen CSS pixels.
    const cssRadius = brushRadius * (rect.width / canvas.width);
    const cssDiameter = cssRadius * 2;
    cursor.style.left = `${String(clientX - rect.left)}px`;
    cursor.style.top = `${String(clientY - rect.top)}px`;
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

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Mask correction canvas — drag to paint corrections"
        className="w-full touch-none rounded-xl bg-[length:16px_16px] bg-[image:repeating-conic-gradient(var(--color-border)_0%_25%,transparent_0%_50%)]"
        style={{ cursor: "none" }}
        onPointerEnter={(event) => {
          updateCursor(event.clientX, event.clientY);
          if (cursorRef.current) cursorRef.current.style.opacity = "1";
        }}
        onPointerLeave={() => {
          if (cursorRef.current) cursorRef.current.style.opacity = "0";
        }}
        onPointerDown={(event) => {
          if (!rgbaRef.current) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          isPaintingRef.current = true;
          gestureBoxRef.current = null;
          stampAndRepaint(toMattePoint(event.clientX, event.clientY));
        }}
        onPointerMove={(event) => {
          updateCursor(event.clientX, event.clientY);
          if (!isPaintingRef.current) return;
          stampAndRepaint(toMattePoint(event.clientX, event.clientY));
        }}
        onPointerUp={(event) => {
          if (!isPaintingRef.current) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          isPaintingRef.current = false;
          const canvas = canvasRef.current;
          const imageData = rgbaRef.current;
          const committed = committedAlphaRef.current;
          const box = gestureBoxRef.current;
          gestureBoxRef.current = null;
          // A gesture that never touched a pixel (e.g. radius 0, or entirely
          // outside the image) commits nothing — no empty undo steps.
          if (!canvas || !imageData || !committed || !box) return;
          const after = extractAlphaRegion(imageData.data, canvas.width, box);
          const before = readPlaneRegion(committed, canvas.width, box);
          // Advance the committed baseline to include this gesture.
          writePlaneRegion(committed, canvas.width, box, after);
          onStrokeCommitted({ box, before, after });
        }}
        onPointerCancel={() => {
          if (!isPaintingRef.current) return;
          isPaintingRef.current = false;
          const canvas = canvasRef.current;
          const imageData = rgbaRef.current;
          const committed = committedAlphaRef.current;
          const box = gestureBoxRef.current;
          gestureBoxRef.current = null;
          if (!canvas || !imageData || !committed || !box) return;
          // Revert the aborted gesture's stamps so the canvas never shows
          // pixels that were never committed (previously they lingered).
          const baseline = readPlaneRegion(committed, canvas.width, box);
          writeAlphaRegion(imageData.data, canvas.width, box, baseline);
          repaintRect(box);
        }}
      />
      <div
        ref={cursorRef}
        aria-hidden="true"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 transition-opacity"
        style={{
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
