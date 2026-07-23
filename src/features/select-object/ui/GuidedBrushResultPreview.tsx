import { useCallback, useEffect, useRef, type RefObject } from "react";

import { m } from "@/paraglide/messages";
import type { AlphaMatte, SourceImage } from "../../../entities/processed-image";
import { GuidedBrushImageFrame } from "./GuidedBrushImageFrame";

interface Props {
  source: SourceImage;
  colorSource: Blob;
  matteRef: RefObject<AlphaMatte | null>;
  matteRevision: number | string;
  hasMatte: boolean;
}

export function GuidedBrushResultPreview({
  source,
  colorSource,
  matteRef,
  matteRevision,
  hasMatte,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setImageRef = useCallback(
    (image: HTMLImageElement | null) => {
      if (!image) {
        imageRef.current = null;
        return;
      }
      imageRef.current = image;
      const url = URL.createObjectURL(colorSource);
      image.src = url;
      return () => {
        if (imageRef.current === image) imageRef.current = null;
        URL.revokeObjectURL(url);
      };
    },
    [colorSource],
  );

  useEffect(() => {
    const matte = matteRef.current;
    const image = imageRef.current;
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!matte || !image || !canvas || !frame) return;

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
      const pixels = context.getImageData(0, 0, width, height);
      for (let y = 0; y < height; y += 1) {
        const sourceY = Math.min(
          matte.height - 1,
          Math.floor((y / height) * matte.height),
        );
        for (let x = 0; x < width; x += 1) {
          const sourceX = Math.min(
            matte.width - 1,
            Math.floor((x / width) * matte.width),
          );
          const offset = (y * width + x) * 4 + 3;
          pixels.data[offset] = Math.round(
            (pixels.data[offset]! * (matte.data[sourceY * matte.width + sourceX] ?? 0)) /
              255,
          );
        }
      }
      context.putImageData(pixels, 0, 0);
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
  }, [colorSource, hasMatte, matteRef, matteRevision, source.height, source.width]);

  return (
    <div
      className="flex min-h-48 w-full items-start justify-center rounded-xl bg-muted/40"
      data-testid="guided-brush-result-preview"
    >
      <GuidedBrushImageFrame
        width={source.width}
        height={source.height}
        frameRef={frameRef}
        testId="guided-brush-result-checkerboard"
      >
        <img
          ref={setImageRef}
          alt=""
          aria-hidden="true"
          draggable={false}
          data-testid="guided-brush-result-source"
          className="hidden"
        />
        {hasMatte ? (
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={m.guidedBrushResultPreviewAlt()}
            data-testid="guided-brush-result-canvas"
            className="absolute inset-0 size-full"
          />
        ) : (
          <p className="absolute inset-0 grid place-items-center bg-background/70 p-6 text-center text-sm text-muted-foreground">
            {m.guidedBrushResultEmpty()}
          </p>
        )}
      </GuidedBrushImageFrame>
    </div>
  );
}
