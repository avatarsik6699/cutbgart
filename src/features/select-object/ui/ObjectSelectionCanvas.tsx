import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import type { AlphaMatte, SourceImage } from "../../../entities/processed-image";
import { m } from "@/paraglide/messages";
import { Button } from "../../../shared/ui";
import { createMaskOverlayPixels } from "../model/mask-overlay";
import { displayPointToNormalized } from "../model/prompt-coordinates";
import type { ObjectSelectionStatus, SelectionPrompt } from "../model/types";

interface Props {
  source: SourceImage;
  status: ObjectSelectionStatus;
  matte: AlphaMatte | null;
  prompt: SelectionPrompt | null;
  progress: number | null;
  error?: string | null;
  onPrompt: (prompt: SelectionPrompt) => void;
  onAccept: () => void;
  onReplace: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

function boxStyle(start: Point, end: Point) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  return {
    left: `${String(left * 100)}%`,
    top: `${String(top * 100)}%`,
    width: `${String(Math.abs(end.x - start.x) * 100)}%`,
    height: `${String(Math.abs(end.y - start.y) * 100)}%`,
  };
}

export function ObjectSelectionCanvas({
  source,
  status,
  matte,
  prompt,
  progress,
  error,
  onPrompt,
  onAccept,
  onReplace,
  onRetry,
  onCancel,
}: Props) {
  const [tool, setTool] = useState<"point" | "box">("point");
  const [draftBox, setDraftBox] = useState<{ start: Point; end: Point } | null>(null);
  const startRef = useRef<Point | null>(null);
  const url = useMemo(() => URL.createObjectURL(source.blob), [source.blob]);
  const imageRef = useRef<HTMLImageElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  useEffect(() => {
    if (!matte) return;
    const image = imageRef.current;
    const canvas = maskCanvasRef.current;
    if (!image || !canvas) return;

    const paint = () => {
      const rect = image.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * scale));
      const height = Math.max(1, Math.round(rect.height * scale));
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.putImageData(
        new ImageData(createMaskOverlayPixels(matte, width, height), width, height),
        0,
        0,
      );
    };

    if (image.complete) paint();
    else image.addEventListener("load", paint);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(paint);
    observer?.observe(image);
    window.addEventListener("resize", paint);
    return () => {
      image.removeEventListener("load", paint);
      observer?.disconnect();
      window.removeEventListener("resize", paint);
    };
  }, [matte]);

  const pointFor = (clientX: number, clientY: number) => {
    const rect = imageRef.current!.getBoundingClientRect();
    return displayPointToNormalized(clientX, clientY, rect);
  };
  const interactionReady = status === "ready-for-prompt" || status === "preview";
  const onPointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (!interactionReady) return;
    const point = pointFor(event.clientX, event.clientY);
    if (tool === "point") onPrompt({ type: "point", ...point, label: 1 });
    else {
      event.currentTarget.setPointerCapture(event.pointerId);
      startRef.current = point;
      setDraftBox({ start: point, end: point });
    }
  };
  const onPointerMove = (event: PointerEvent<HTMLImageElement>) => {
    if (tool === "box" && startRef.current) {
      setDraftBox({
        start: startRef.current,
        end: pointFor(event.clientX, event.clientY),
      });
    }
  };
  const onPointerUp = (event: PointerEvent<HTMLImageElement>) => {
    const start = startRef.current;
    if (tool !== "box" || !start) return;
    const end = pointFor(event.clientX, event.clientY);
    startRef.current = null;
    setDraftBox(null);
    onPrompt({ type: "box", xMin: start.x, yMin: start.y, xMax: end.x, yMax: end.y });
  };
  const onPointerCancel = () => {
    startRef.current = null;
    setDraftBox(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLImageElement>) => {
    if (!interactionReady || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onPrompt(
      tool === "point"
        ? { type: "point", x: 0.5, y: 0.5, label: 1 }
        : { type: "box", xMin: 0.25, yMin: 0.25, xMax: 0.75, yMax: 0.75 },
    );
  };

  const busy =
    status === "loading-model" ||
    status === "encoding-image" ||
    status === "predicting-mask";
  const visibleBox = draftBox
    ? draftBox
    : prompt?.type === "box"
      ? {
          start: { x: prompt.xMin, y: prompt.yMin },
          end: { x: prompt.xMax, y: prompt.yMax },
        }
      : null;
  const statusText =
    status === "loading-model"
      ? m.guidedLoadingModel({ progress: String(Math.round(progress ?? 0)) })
      : status === "encoding-image"
        ? m.guidedEncodingImage()
        : status === "predicting-mask"
          ? m.guidedPredictingMask()
          : status === "preview"
            ? m.guidedPreviewReady()
            : status === "error"
              ? m.guidedError()
              : m.guidedReady();

  return (
    <section
      className="space-y-3"
      aria-labelledby="guided-title"
      data-testid="guided-selection"
    >
      <div>
        <h2 id="guided-title" className="font-semibold">
          {m.guidedTitle()}
        </h2>
        <p className="text-sm text-muted-foreground">{m.guidedHint()}</p>
      </div>
      <div className="flex gap-2" role="toolbar" aria-label={m.guidedToolLabel()}>
        <Button
          type="button"
          variant={tool === "point" ? "default" : "outline"}
          disabled={busy}
          aria-pressed={tool === "point"}
          onClick={() => setTool("point")}
        >
          {m.guidedPoint()}
        </Button>
        <Button
          type="button"
          variant={tool === "box" ? "default" : "outline"}
          disabled={busy}
          aria-pressed={tool === "box"}
          onClick={() => setTool("box")}
        >
          {m.guidedBox()}
        </Button>
      </div>
      <div className="flex w-full justify-center rounded-xl bg-muted/40">
        <div className="relative inline-block max-w-full overflow-hidden rounded-xl border">
          <img
            ref={imageRef}
            src={url || undefined}
            alt={m.guidedCanvasAlt()}
            aria-describedby="guided-status"
            draggable={false}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onKeyDown={onKeyDown}
            className={`block h-auto max-h-[60vh] w-auto max-w-full touch-none select-none focus-visible:outline-2 focus-visible:outline-primary ${interactionReady ? "cursor-crosshair" : "cursor-wait"}`}
          />
          {matte && (
            <canvas
              ref={maskCanvasRef}
              data-testid="guided-mask-overlay"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full"
            />
          )}
          {prompt?.type === "point" && (
            <span
              data-testid="guided-point-marker"
              aria-hidden="true"
              className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow-[0_0_0_2px_rgba(2,132,199,0.9)]"
              style={{
                left: `${String(prompt.x * 100)}%`,
                top: `${String(prompt.y * 100)}%`,
              }}
            />
          )}
          {visibleBox && (
            <span
              data-testid={draftBox ? "guided-box-draft" : "guided-box-marker"}
              aria-hidden="true"
              className="pointer-events-none absolute border-2 border-sky-400 bg-sky-400/15 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
              style={boxStyle(visibleBox.start, visibleBox.end)}
            />
          )}
          {busy && (
            <span
              data-testid="guided-busy-overlay"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 grid place-items-center bg-background/25"
            >
              <span className="size-8 animate-pulse rounded-full border-4 border-primary/35 border-t-primary" />
            </span>
          )}
        </div>
      </div>
      <div id="guided-status" className="space-y-2">
        <p
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={
            status === "error"
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {statusText}
        </p>
        {status === "loading-model" && progress !== null && (
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${String(Math.round(progress))}%` }}
            />
          </div>
        )}
        {status === "preview" && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-3 rounded-sm bg-sky-500/45" aria-hidden="true" />
            {m.guidedMaskLegend()}
          </p>
        )}
        {status === "error" && error && (
          <p className="break-words text-xs text-muted-foreground">{error}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "preview" && (
          <Button type="button" onClick={onAccept}>
            {m.guidedAccept()}
          </Button>
        )}
        {status === "preview" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraftBox(null);
              onReplace();
            }}
          >
            {m.guidedReplace()}
          </Button>
        )}
        {status === "error" && (
          <Button type="button" variant="outline" onClick={onRetry}>
            {m.tryAgain()}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancel}>
          {m.guidedCancel()}
        </Button>
      </div>
    </section>
  );
}
