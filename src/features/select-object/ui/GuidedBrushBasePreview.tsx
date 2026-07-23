import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEventHandler,
  type PointerEventHandler,
  type ReactNode,
  type RefObject,
} from "react";

import { m } from "@/paraglide/messages";
import type { AlphaMatte, SourceImage } from "../../../entities/processed-image";
import { GuidedBrushImageFrame } from "./GuidedBrushImageFrame";

const REMOVED_CONTEXT_OPACITY = 0.18;

interface Props {
  source: SourceImage;
  baseMatteRef: RefObject<AlphaMatte | null>;
  baseMatteRevision: number | string | null;
  showProcessedBase: boolean;
  busy: boolean;
  interactionReady: boolean;
  children: ReactNode;
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerEnter: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
  onPointerCancel: PointerEventHandler<HTMLCanvasElement>;
  onPointerLeave: PointerEventHandler<HTMLCanvasElement>;
  onKeyDown: KeyboardEventHandler<HTMLCanvasElement>;
  surfaceRef: RefObject<HTMLCanvasElement | null>;
}

export function GuidedBrushBasePreview({
  source,
  baseMatteRef,
  baseMatteRevision,
  showProcessedBase,
  busy,
  interactionReady,
  children,
  onPointerDown,
  onPointerEnter,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onKeyDown,
  surfaceRef,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);

  const setSourceImageRef = useCallback(
    (image: HTMLImageElement | null) => {
      if (!image) {
        sourceImageRef.current = null;
        return;
      }
      sourceImageRef.current = image;
      const url = URL.createObjectURL(source.blob);
      image.src = url;
      return () => {
        if (sourceImageRef.current === image) sourceImageRef.current = null;
        URL.revokeObjectURL(url);
      };
    },
    [source.blob],
  );

  useEffect(() => {
    const image = sourceImageRef.current;
    const frame = frameRef.current;
    const canvas = surfaceRef.current;
    if (!image || !frame || !canvas) return;

    let resizeFrame: number | null = null;
    const paint = () => {
      const rect = frame.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || !image.complete) return;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * scale));
      const height = Math.max(1, Math.round(rect.height * scale));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const baseMatte = baseMatteRef.current;
      if (showProcessedBase && baseMatte) {
        const pixels = context.getImageData(0, 0, width, height);
        for (let y = 0; y < height; y += 1) {
          const sourceY = Math.min(
            baseMatte.height - 1,
            Math.floor((y / height) * baseMatte.height),
          );
          for (let x = 0; x < width; x += 1) {
            const sourceX = Math.min(
              baseMatte.width - 1,
              Math.floor((x / width) * baseMatte.width),
            );
            const offset = (y * width + x) * 4 + 3;
            const matteAlpha =
              (baseMatte.data[sourceY * baseMatte.width + sourceX] ?? 0) / 255;
            const displayAlpha =
              REMOVED_CONTEXT_OPACITY + (1 - REMOVED_CONTEXT_OPACITY) * matteAlpha;
            pixels.data[offset] = Math.round(pixels.data[offset]! * displayAlpha);
          }
        }
        context.putImageData(pixels, 0, 0);
      }
    };
    const scheduleResizePaint = () => {
      if (resizeFrame !== null) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        paint();
      });
    };

    if (image.complete) paint();
    else image.addEventListener("load", paint);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleResizePaint);
    observer?.observe(frame);
    window.addEventListener("resize", scheduleResizePaint);
    return () => {
      image.removeEventListener("load", paint);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleResizePaint);
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    };
  }, [
    baseMatteRef,
    baseMatteRevision,
    showProcessedBase,
    source.blob,
    source.height,
    source.width,
    surfaceRef,
  ]);

  return (
    <GuidedBrushImageFrame
      width={source.width}
      height={source.height}
      frameRef={frameRef}
      testId="guided-brush-edit-frame"
    >
      <img
        ref={setSourceImageRef}
        alt=""
        aria-hidden="true"
        data-testid="guided-brush-edit-source"
        className="hidden"
      />
      <canvas
        ref={surfaceRef}
        role="img"
        aria-label={m.guidedBrushCanvasAlt()}
        aria-describedby="guided-brush-status"
        data-testid="guided-brush-edit-image"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerEnter={onPointerEnter}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
        className={`absolute inset-0 size-full touch-none select-none focus-visible:outline-2 focus-visible:outline-primary ${
          interactionReady && !busy ? "cursor-none" : "cursor-wait"
        }`}
      />
      {children}
    </GuidedBrushImageFrame>
  );
}
