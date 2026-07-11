import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AlphaMatte,
  MaskPatch,
  SourceImage,
} from "../../../entities/processed-image";
import { MaskCorrectionCanvas, type MaskCanvasHandle } from "./MaskCorrectionCanvas";

function makeSourceImage(): SourceImage {
  return {
    blob: new Blob(["fake"], { type: "image/png" }),
    width: 100,
    height: 50,
    format: "image/png",
  };
}

function makeMatte(width: number, height: number, fill = 255): AlphaMatte {
  return { width, height, data: new Uint8ClampedArray(width * height).fill(fill) };
}

let putImageData: ReturnType<typeof vi.fn>;
let imageData: { data: Uint8ClampedArray };

beforeEach(() => {
  putImageData = vi.fn();
  imageData = { data: new Uint8ClampedArray(100 * 50 * 4) };
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 100, height: 50, close: vi.fn() }),
  );
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue(imageData),
    putImageData,
  });
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

function renderCanvas(
  overrides: Partial<Parameters<typeof MaskCorrectionCanvas>[0]> = {},
) {
  const handleRef = createRef<MaskCanvasHandle>();
  const props = {
    ref: handleRef,
    sourceImage: makeSourceImage(),
    initialMatte: makeMatte(100, 50, 0),
    original: makeMatte(100, 50, 0),
    mode: "add" as const,
    brushRadius: 10,
    brushHardness: 1,
    onStrokeCommitted: vi.fn(),
    ...overrides,
  };
  const view = render(<MaskCorrectionCanvas {...props} />);
  const canvas = screen.getByRole("img", { name: /mask correction canvas/i });
  const getBoundingClientRect = vi
    .spyOn(canvas, "getBoundingClientRect")
    .mockReturnValue({
      left: 0,
      top: 0,
      width: 200, // rendered at 2x — canvas internal pixels are half of client coords
      height: 100,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  return { ...view, canvas, getBoundingClientRect, handleRef, props };
}

async function waitUntilReady() {
  // The working buffer isn't ready until the async `createImageBitmap`
  // decode resolves and the first full repaint happens.
  await waitFor(() => expect(putImageData).toHaveBeenCalled());
  putImageData.mockClear();
}

/** Alpha byte at matte pixel (x, y) in the mocked live RGBA buffer. */
function liveAlphaAt(x: number, y: number): number {
  return imageData.data[(y * 100 + x) * 4 + 3] ?? -1;
}

describe("MaskCorrectionCanvas", () => {
  it("commits one whole gesture as a single patch, not per pointer-move point", async () => {
    const onStrokeCommitted = vi.fn();
    const { canvas } = renderCanvas({ onStrokeCommitted });
    await waitUntilReady();

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 24, clientY: 12, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 28, clientY: 14, pointerId: 1 });
    expect(onStrokeCommitted).not.toHaveBeenCalled();

    fireEvent.pointerUp(canvas, { clientX: 28, clientY: 14, pointerId: 1 });

    expect(onStrokeCommitted).toHaveBeenCalledTimes(1);
    const patch = onStrokeCommitted.mock.calls[0]?.[0] as MaskPatch;
    const boxWidth = patch.box.maxX - patch.box.minX + 1;
    const boxHeight = patch.box.maxY - patch.box.minY + 1;
    expect(patch.before).toHaveLength(boxWidth * boxHeight);
    expect(patch.after).toHaveLength(boxWidth * boxHeight);
    // initial matte was fully transparent; an "add" stroke turns the stamp
    // center opaque — before records the old bytes, after the new ones.
    const center = (5 - patch.box.minY) * boxWidth + (10 - patch.box.minX); // client (20,10) → matte (10,5)
    expect(patch.before[center]).toBe(0);
    expect(patch.after[center]).toBe(255);
  });

  it("repaints only the touched bounding box while dragging (dirty-rect putImageData), not the whole canvas", async () => {
    const { canvas } = renderCanvas();
    await waitUntilReady();

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 10, pointerId: 1 });

    expect(putImageData).toHaveBeenCalledTimes(1);
    // dirty-rect overload: (imageData, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight)
    expect(putImageData.mock.calls[0]).toHaveLength(7);
  });

  it("interpolates fast drags in the live buffer instead of painting only isolated dabs", async () => {
    const { canvas } = renderCanvas({ brushRadius: 1 });
    await waitUntilReady();

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 60, clientY: 10, pointerId: 1 });

    // client (40,10) -> matte (20,5), midway between the two pointer events.
    expect(liveAlphaAt(20, 5)).toBe(255);
  });

  it("reads getBoundingClientRect once per painting gesture and reuses it for cursor and matte coordinates", async () => {
    const { canvas, getBoundingClientRect } = renderCanvas();
    await waitUntilReady();
    getBoundingClientRect.mockClear();

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 28, clientY: 14, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 36, clientY: 18, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 36, clientY: 18, pointerId: 1 });

    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
  });

  it("refreshes cached gesture geometry after viewport invalidation during pointer capture", async () => {
    const { canvas, getBoundingClientRect } = renderCanvas({ brushRadius: 1 });
    await waitUntilReady();
    getBoundingClientRect.mockClear();
    getBoundingClientRect
      .mockReturnValueOnce({
        left: 0,
        top: 0,
        width: 200,
        height: 100,
        right: 200,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      })
      .mockReturnValue({
        left: 10,
        top: 0,
        width: 200,
        height: 100,
        right: 210,
        bottom: 100,
        x: 10,
        y: 0,
        toJSON: () => ({}),
      });

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 10, pointerId: 1 });
    window.dispatchEvent(new Event("resize"));
    fireEvent.pointerMove(canvas, { clientX: 30, clientY: 10, pointerId: 1 });

    // With stale geometry, clientX 30 would map to matte x=15 and interpolation
    // would paint this pixel. Refreshed geometry keeps it at matte x=10.
    expect(liveAlphaAt(15, 5)).toBe(0);
    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
  });

  it("a gesture that never touches a pixel commits no patch (no empty undo steps)", async () => {
    const onStrokeCommitted = vi.fn();
    const { canvas } = renderCanvas({ onStrokeCommitted, brushRadius: 0 });
    await waitUntilReady();

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 10, pointerId: 1 });

    expect(onStrokeCommitted).not.toHaveBeenCalled();
  });

  it("ignores pointermove before a pointerdown starts a drag", async () => {
    const onStrokeCommitted = vi.fn();
    const { canvas } = renderCanvas({ onStrokeCommitted });
    await waitUntilReady();

    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 10, pointerId: 1 });

    expect(onStrokeCommitted).not.toHaveBeenCalled();
    expect(putImageData).not.toHaveBeenCalled();
  });

  it("ignores pointerdown before the source image decode has resolved", () => {
    const onStrokeCommitted = vi.fn();
    const { canvas } = renderCanvas({ onStrokeCommitted });
    // No `await waitUntilReady()` — interacting immediately, before the
    // async `createImageBitmap` decode has settled.

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 10, pointerId: 1 });

    expect(onStrokeCommitted).not.toHaveBeenCalled();
  });

  it("composites the initial matte once the source image decode settles", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4).fill(255) }),
      putImageData,
    });
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 1, height: 1, close: vi.fn() }),
    );

    const matte: AlphaMatte = { width: 1, height: 1, data: new Uint8ClampedArray([128]) };
    renderCanvas({
      sourceImage: makeSourceImage(),
      initialMatte: matte,
      original: matte,
    });

    await waitFor(() => expect(putImageData).toHaveBeenCalled());
    const lastCall = putImageData.mock.calls.at(-1) as [{ data: Uint8ClampedArray }];
    expect(lastCall[0].data[3]).toBe(128);
  });

  it("applyPatch writes the region into the live buffer and repaints only its dirty rect", async () => {
    const { handleRef } = renderCanvas();
    await waitUntilReady();

    const box = { minX: 2, maxX: 4, minY: 1, maxY: 2 };
    handleRef.current?.applyPatch(box, new Uint8ClampedArray(6).fill(200));

    expect(liveAlphaAt(2, 1)).toBe(200);
    expect(liveAlphaAt(4, 2)).toBe(200);
    expect(liveAlphaAt(5, 1)).toBe(0); // outside the box untouched
    expect(putImageData).toHaveBeenCalledTimes(1);
    expect(putImageData.mock.calls[0]).toHaveLength(7);
    expect(putImageData.mock.calls[0]?.slice(3)).toEqual([2, 1, 3, 2]);
  });

  it("applyPatch updates the committed baseline the next gesture's before-region reads from", async () => {
    const onStrokeCommitted = vi.fn();
    const { canvas, handleRef } = renderCanvas({ onStrokeCommitted, brushRadius: 1 });
    await waitUntilReady();

    // Simulate a redo landing at matte pixel (10, 5), then stroke over it.
    handleRef.current?.applyPatch(
      { minX: 10, maxX: 10, minY: 5, maxY: 5 },
      new Uint8ClampedArray([200]),
    );

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 10, pointerId: 1 });

    const patch = onStrokeCommitted.mock.calls[0]?.[0] as MaskPatch;
    const boxWidth = patch.box.maxX - patch.box.minX + 1;
    const center = (5 - patch.box.minY) * boxWidth + (10 - patch.box.minX);
    expect(patch.before[center]).toBe(200);
  });

  it("extractMatte reads the full current alpha out of the live buffer", async () => {
    const { handleRef } = renderCanvas();
    await waitUntilReady();

    handleRef.current?.applyPatch(
      { minX: 2, maxX: 2, minY: 1, maxY: 1 },
      new Uint8ClampedArray([200]),
    );
    const matte = handleRef.current?.extractMatte();

    expect(matte?.width).toBe(100);
    expect(matte?.height).toBe(50);
    expect(matte?.data[1 * 100 + 2]).toBe(200);
    expect(matte?.data[0]).toBe(0);
  });

  it("pointercancel reverts the aborted gesture's stamps instead of leaving them uncommitted", async () => {
    const onStrokeCommitted = vi.fn();
    const { canvas } = renderCanvas({ onStrokeCommitted });
    await waitUntilReady();

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 10, pointerId: 1 });
    expect(liveAlphaAt(10, 5)).toBe(255); // stamp visible mid-gesture

    fireEvent.pointerCancel(canvas, { pointerId: 1 });

    expect(onStrokeCommitted).not.toHaveBeenCalled();
    expect(liveAlphaAt(10, 5)).toBe(0); // reverted to the committed baseline
  });

  it("shows a hover cursor sized to the brush radius, hidden until the pointer enters", async () => {
    const { canvas, container } = renderCanvas({ brushRadius: 20 });
    await waitUntilReady();
    const cursor = container.querySelector('[aria-hidden="true"]') as HTMLDivElement;
    // Initially hidden via the `opacity-0` Tailwind class (not inline style,
    // which jsdom doesn't resolve from compiled CSS) until the pointer
    // actually enters the canvas.
    expect(cursor.className).toContain("opacity-0");

    fireEvent.pointerEnter(canvas, { clientX: 50, clientY: 25 });

    expect(cursor.style.opacity).toBe("1");
    // brushRadius (20 source px) * 2 (rect.width/canvas.width scale) * 2 (diameter) = 80px
    expect(cursor.style.width).toBe("80px");

    fireEvent.pointerLeave(canvas);
    expect(cursor.style.opacity).toBe("0");
  });
});
