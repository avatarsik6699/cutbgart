import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

import { m } from "@/paraglide/messages";
import type { AlphaMatte } from "../../../entities/processed-image";
import { createMaskOverlayPixels } from "../model/mask-overlay";
import { displayPointToNormalized } from "../model/prompt-coordinates";
import type {
  GuidedBox,
  ObjectSelectionStatus,
  PromptPointLabel,
  PromptSession,
  SemanticStrokeMode,
} from "../model/types";
import { ObjectSelectionControls, type GuidedTool } from "./ObjectSelectionControls";

interface Props {
  session: PromptSession;
  status: ObjectSelectionStatus;
  matteRef: RefObject<AlphaMatte | null>;
  matteRevision: number;
  hasMatte: boolean;
  progress: number | null;
  error?: string | null;
  onPoint: (x: number, y: number, label: PromptPointLabel) => void;
  onBox: (box: GuidedBox) => void;
  onStroke: (stroke: {
    mode: SemanticStrokeMode;
    points: readonly { x: number; y: number }[];
    radius: number;
  }) => void;
  onAddLayer: () => void;
  onSelectLayer: (id: string) => void;
  onRemoveLayer: (id: string) => void;
  onSelectCandidate: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetLayer: () => void;
  onAccept: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

function boxStyle(start: Point, end: Point) {
  return {
    left: `${String(Math.min(start.x, end.x) * 100)}%`,
    top: `${String(Math.min(start.y, end.y) * 100)}%`,
    width: `${String(Math.abs(end.x - start.x) * 100)}%`,
    height: `${String(Math.abs(end.y - start.y) * 100)}%`,
  };
}

/** @deprecated Phase-17 compatibility UI; use `GuidedBrushCanvas` in production. */
export function ObjectSelectionCanvas(props: Props) {
  const { session, status, matteRef, matteRevision, progress, error, onUndo, onRedo } =
    props;
  const [tool, setTool] = useState<GuidedTool>("positive");
  const [draft, setDraft] = useState<readonly Point[]>([]);
  const startRef = useRef<Point | null>(null);
  const draftRef = useRef<Point[]>([]);
  const imageRef = useRef<HTMLImageElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const active = session.layers.find((layer) => layer.id === session.activeLayerId)!;
  const busy =
    status === "loading-model" ||
    status === "encoding-image" ||
    status === "predicting-mask";

  const setImageRef = useCallback(
    (image: HTMLImageElement | null) => {
      if (!image) {
        imageRef.current = null;
        return;
      }
      imageRef.current = image;
      const url = URL.createObjectURL(session.source.blob);
      image.src = url;
      return () => {
        if (imageRef.current === image) imageRef.current = null;
        URL.revokeObjectURL(url);
      };
    },
    [session.source.blob],
  );

  useEffect(() => {
    const onShortcut = (event: globalThis.KeyboardEvent) => {
      if (busy || (!event.ctrlKey && !event.metaKey) || event.altKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'textarea, select, [contenteditable="true"], input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="range"])',
        )
      )
        return;
      const key = event.key.toLowerCase();
      const wantsUndo = key === "z" && !event.shiftKey;
      const wantsRedo = key === "y" || (key === "z" && event.shiftKey);
      if (wantsUndo && session.history.length) {
        event.preventDefault();
        onUndo();
      } else if (wantsRedo && session.redo.length) {
        event.preventDefault();
        onRedo();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [busy, onRedo, onUndo, session.history.length, session.redo.length]);

  useEffect(() => {
    const matte = matteRef.current;
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
      canvas
        .getContext("2d")
        ?.putImageData(
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
  }, [matteRef, matteRevision]);

  const pointFor = (clientX: number, clientY: number) =>
    displayPointToNormalized(clientX, clientY, imageRef.current!.getBoundingClientRect());
  const interactionReady = status === "ready-for-prompt" || status === "preview";
  const onPointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (!interactionReady) return;
    const point = pointFor(event.clientX, event.clientY);
    if (tool === "positive" || tool === "negative") {
      props.onPoint(point.x, point.y, tool === "positive" ? 1 : 0);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = point;
    draftRef.current = [point];
    setDraft([point]);
  };
  const onPointerMove = (event: PointerEvent<HTMLImageElement>) => {
    if (!startRef.current) return;
    const point = pointFor(event.clientX, event.clientY);
    if (tool === "box") setDraft([startRef.current, point]);
    else {
      draftRef.current.push(point);
      setDraft([...draftRef.current]);
    }
  };
  const finishGesture = (event: PointerEvent<HTMLImageElement>) => {
    const start = startRef.current;
    if (!start) return;
    const end = pointFor(event.clientX, event.clientY);
    const points = [...draftRef.current, end];
    startRef.current = null;
    draftRef.current = [];
    setDraft([]);
    if (tool === "box")
      props.onBox({ xMin: start.x, yMin: start.y, xMax: end.x, yMax: end.y });
    else
      props.onStroke({
        mode: tool === "keep" ? "keep" : "remove",
        points,
        radius: Math.max(2, Math.round(session.source.width * 0.01)),
      });
  };
  const cancelGesture = () => {
    startRef.current = null;
    draftRef.current = [];
    setDraft([]);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLImageElement>) => {
    if (!interactionReady || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    if (tool === "positive" || tool === "negative")
      props.onPoint(0.5, 0.5, tool === "positive" ? 1 : 0);
    else if (tool === "box")
      props.onBox({ xMin: 0.25, yMin: 0.25, xMax: 0.75, yMax: 0.75 });
    else
      props.onStroke({
        mode: tool === "keep" ? "keep" : "remove",
        points: [
          { x: 0.45, y: 0.5 },
          { x: 0.55, y: 0.5 },
        ],
        radius: Math.max(2, Math.round(session.source.width * 0.01)),
      });
  };

  const visibleBox =
    draft.length === 2 && tool === "box"
      ? { start: draft[0]!, end: draft[1]! }
      : active.targetBox
        ? {
            start: { x: active.targetBox.xMin, y: active.targetBox.yMin },
            end: { x: active.targetBox.xMax, y: active.targetBox.yMax },
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
      className="space-y-4"
      aria-labelledby="guided-title"
      data-testid="guided-selection"
    >
      <div>
        <h2 id="guided-title" className="font-semibold">
          {m.guidedTitle()}
        </h2>
        <p className="text-sm text-muted-foreground">{m.guidedHint()}</p>
      </div>
      <ObjectSelectionControls
        tool={tool}
        onToolChange={setTool}
        session={session}
        status={status}
        canAccept={session.layers.some((layer) => layer.acceptedMatte)}
        onAddLayer={props.onAddLayer}
        onSelectLayer={props.onSelectLayer}
        onRemoveLayer={props.onRemoveLayer}
        onSelectCandidate={props.onSelectCandidate}
        onUndo={props.onUndo}
        onRedo={props.onRedo}
        onResetLayer={props.onResetLayer}
        onAccept={props.onAccept}
        onRetry={props.onRetry}
        onCancel={props.onCancel}
      />
      <div className="flex w-full justify-center rounded-xl bg-muted/40">
        <div className="relative inline-block max-w-full overflow-hidden rounded-xl border">
          <img
            ref={setImageRef}
            alt={m.guidedCanvasAlt()}
            aria-describedby="guided-status"
            draggable={false}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishGesture}
            onPointerCancel={cancelGesture}
            onKeyDown={onKeyDown}
            className={`block h-auto max-h-[60vh] w-[min(40rem,calc(100vw-3rem))] touch-none select-none object-contain focus-visible:outline-2 focus-visible:outline-primary ${interactionReady ? "cursor-crosshair" : "cursor-wait"}`}
          />
          {props.hasMatte && (
            <canvas
              ref={maskCanvasRef}
              data-testid="guided-mask-overlay"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full"
            />
          )}
          {session.layers
            .flatMap((layer) => layer.points)
            .map((point) => (
              <span
                key={point.id}
                data-testid={
                  point.label ? "guided-positive-marker" : "guided-negative-marker"
                }
                aria-hidden="true"
                className={`pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${point.label ? "bg-emerald-500" : "bg-rose-500"}`}
                style={{
                  left: `${String(point.x * 100)}%`,
                  top: `${String(point.y * 100)}%`,
                }}
              />
            ))}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {session.layers
              .flatMap((layer) => layer.strokes)
              .map((stroke) => (
                <polyline
                  key={stroke.id}
                  points={stroke.points
                    .map((point) => `${String(point.x * 100)},${String(point.y * 100)}`)
                    .join(" ")}
                  fill="none"
                  stroke={stroke.mode === "keep" ? "#22c55e" : "#f43f5e"}
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            {draft.length > 1 && tool !== "box" && (
              <polyline
                data-testid="guided-stroke-draft"
                points={draft
                  .map((point) => `${String(point.x * 100)},${String(point.y * 100)}`)
                  .join(" ")}
                fill="none"
                stroke={tool === "keep" ? "#22c55e" : "#f43f5e"}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {visibleBox && (
            <span
              data-testid={draft.length ? "guided-box-draft" : "guided-box-marker"}
              aria-hidden="true"
              className="pointer-events-none absolute border-2 border-sky-400 bg-sky-400/15"
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
        {status === "error" && error && (
          <p className="break-words text-xs text-muted-foreground">{error}</p>
        )}
        {props.hasMatte && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="size-3 shrink-0 rounded-sm bg-sky-500/45"
              aria-hidden="true"
            />
            {m.guidedMaskLegend()}
          </p>
        )}
      </div>
    </section>
  );
}
