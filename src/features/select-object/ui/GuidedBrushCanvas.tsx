import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

import { m } from "@/paraglide/messages";
import {
  GUIDED_BRUSH_POINT_LIMIT,
  GUIDED_BRUSH_STROKE_LIMIT,
} from "../model/guided-brush-session";
import { guidedBrushHardCoreRadius } from "../model/guided-brush-sampling";
import { displayPointToNormalized } from "../model/prompt-coordinates";
import type {
  GuidedBrushMode,
  GuidedBrushStatus,
  GuidedBrushViewSession,
} from "../model/types";
import { GuidedBrushBasePreview } from "./GuidedBrushBasePreview";

interface Point {
  x: number;
  y: number;
}

interface GuidedBrushViewportControls {
  viewport: { zoom: number; offsetX: number; offsetY: number };
  zoomPercent: number;
  zoomIn: (anchor?: Point) => void;
  zoomOut: (anchor?: Point) => void;
  zoomByWheel: (deltaY: number, anchor: Point) => void;
  resetView: () => void;
  panView: (deltaX: number, deltaY: number, speed?: "normal" | "fast") => void;
  panBySourcePixels: (deltaX: number, deltaY: number) => void;
}

interface Props {
  session: GuidedBrushViewSession;
  status: GuidedBrushStatus;
  baseMatteRef: RefObject<import("../../../entities/processed-image").AlphaMatte | null>;
  baseMatteRevision: number | string | null;
  entryKind: "direct" | "processed";
  applying?: boolean;
  mode: GuidedBrushMode;
  viewportControls: GuidedBrushViewportControls;
  surfaceTargetRef?: RefObject<HTMLCanvasElement | null>;
  promptCounts?: {
    total: number | null;
    keep: number | null;
    remove: number | null;
  };
  onStroke: (stroke: {
    mode: GuidedBrushMode;
    points: readonly Point[];
    radius?: number;
  }) => void;
  onUndo: () => void;
  onRedo: () => void;
}

function strokePoints(points: readonly Point[], width: number, height: number): string {
  return points
    .map((point) => `${String(point.x * width)},${String(point.y * height)}`)
    .join(" ");
}

export function GuidedBrushCanvas({
  session,
  status,
  applying = false,
  mode,
  viewportControls,
  onUndo,
  onRedo,
  ...props
}: Props) {
  const draftRef = useRef<Point[]>([]);
  const draftHaloPolylineRef = useRef<SVGPolylineElement>(null);
  const draftCorePolylineRef = useRef<SVGPolylineElement>(null);
  const cursorRef = useRef<SVGCircleElement>(null);
  const coreCursorRef = useRef<SVGCircleElement>(null);
  const ownedSurfaceRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = props.surfaceTargetRef ?? ownedSurfaceRef;
  const viewportRef = useRef<HTMLDivElement>(null);
  const interactionRectRef = useRef<DOMRect | null>(null);
  const spacePanningRef = useRef(false);
  const panningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const [spacePanning, setSpacePanning] = useState(false);
  const [panning, setPanning] = useState(false);
  const busy =
    applying ||
    status === "loading-model" ||
    status === "encoding-image" ||
    status === "predicting";
  const interactionReady = status !== "loading-model" && status !== "encoding-image";
  const processedBase = props.entryKind === "processed" && session.hasBaseMatte;

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

  const cacheInteractionRect = (surface: HTMLCanvasElement) => {
    interactionRectRef.current = surface.getBoundingClientRect();
  };
  const ensureInteractionRect = (surface: HTMLCanvasElement) => {
    if (!interactionRectRef.current) cacheInteractionRect(surface);
  };
  const pointFor = (clientX: number, clientY: number) =>
    displayPointToNormalized(
      clientX,
      clientY,
      interactionRectRef.current ?? surfaceRef.current!.getBoundingClientRect(),
    );
  const moveCursor = (point: Point, visible = true) => {
    const cursor = cursorRef.current;
    const coreCursor = coreCursorRef.current;
    if (!cursor || !coreCursor) return;
    for (const circle of [cursor, coreCursor]) {
      circle.setAttribute("cx", String(point.x * session.source.width));
      circle.setAttribute("cy", String(point.y * session.source.height));
      circle.style.opacity = visible ? "1" : "0";
    }
  };
  const paintDraft = () => {
    const points = strokePoints(
      draftRef.current,
      session.source.width,
      session.source.height,
    );
    draftHaloPolylineRef.current?.setAttribute("points", points);
    draftCorePolylineRef.current?.setAttribute("points", points);
  };
  const appendDraftPoint = (point: Point, force = false) => {
    const points = draftRef.current;
    const last = points.at(-1);
    if (points.length >= GUIDED_BRUSH_POINT_LIMIT) return;
    if (last && !force) {
      const dx = (point.x - last.x) * session.source.width;
      const dy = (point.y - last.y) * session.source.height;
      if (Math.hypot(dx, dy) < Math.max(1, session.brushRadius / 3)) return;
    }
    if (!last || last.x !== point.x || last.y !== point.y) points.push(point);
    paintDraft();
  };
  const stopPanning = () => {
    panningRef.current = false;
    setPanning(false);
    lastPanPointRef.current = null;
    interactionRectRef.current = null;
  };
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const handGesture = spacePanningRef.current || event.button === 1;
    if (handGesture) {
      event.preventDefault();
      panningRef.current = true;
      setPanning(true);
      lastPanPointRef.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (
      event.button !== 0 ||
      event.isPrimary === false ||
      !interactionReady ||
      busy ||
      session.strokes.length >= GUIDED_BRUSH_STROKE_LIMIT
    )
      return;
    event.preventDefault();
    ensureInteractionRect(event.currentTarget);
    const point = pointFor(event.clientX, event.clientY);
    draftRef.current = [point];
    paintDraft();
    moveCursor(point);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (panningRef.current) {
      const previous = lastPanPointRef.current;
      const rect =
        interactionRectRef.current ?? event.currentTarget.getBoundingClientRect();
      if (previous && rect.width > 0 && rect.height > 0) {
        viewportControls.panBySourcePixels(
          ((previous.x - event.clientX) / rect.width) * session.source.width,
          ((previous.y - event.clientY) / rect.height) * session.source.height,
        );
      }
      lastPanPointRef.current = { x: event.clientX, y: event.clientY };
      return;
    }
    ensureInteractionRect(event.currentTarget);
    const point = pointFor(event.clientX, event.clientY);
    moveCursor(point);
    if (!draftRef.current.length) return;
    appendDraftPoint(point);
  };
  const finishGesture = (event: PointerEvent<HTMLCanvasElement>) => {
    if (panningRef.current) {
      stopPanning();
      return;
    }
    if (!draftRef.current.length) return;
    event.preventDefault();
    appendDraftPoint(pointFor(event.clientX, event.clientY), true);
    const points = [...draftRef.current];
    draftRef.current = [];
    paintDraft();
    props.onStroke({
      mode,
      points,
      radius: session.brushRadius,
    });
  };
  const cancelGesture = () => {
    if (panningRef.current) stopPanning();
    draftRef.current = [];
    paintDraft();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (!interactionReady || busy || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    props.onStroke({
      mode,
      points: [
        { x: 0.47, y: 0.5 },
        { x: 0.53, y: 0.5 },
      ],
      radius: session.brushRadius,
    });
  };

  useEffect(() => {
    const editor = viewportRef.current;
    if (!editor) return;
    const releaseHand = () => {
      spacePanningRef.current = false;
      setSpacePanning(false);
      if (panningRef.current) stopPanning();
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      const editingText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      const modifier = event.ctrlKey || event.metaKey;
      const center = {
        x:
          viewportControls.viewport.offsetX +
          session.source.width / viewportControls.viewport.zoom / 2,
        y:
          viewportControls.viewport.offsetY +
          session.source.height / viewportControls.viewport.zoom / 2,
      };
      if (event.key === " " && !editingText) {
        event.preventDefault();
        spacePanningRef.current = true;
        setSpacePanning(true);
      } else if (modifier && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        viewportControls.zoomIn(center);
      } else if (modifier && event.key === "-") {
        event.preventDefault();
        viewportControls.zoomOut(center);
      } else if (modifier && (event.key === "0" || event.key === "1")) {
        event.preventDefault();
        viewportControls.resetView();
      } else if (event.key.startsWith("Arrow") && !editingText) {
        event.preventDefault();
        const speed = event.shiftKey ? "fast" : "normal";
        if (event.key === "ArrowLeft") viewportControls.panView(-1, 0, speed);
        if (event.key === "ArrowRight") viewportControls.panView(1, 0, speed);
        if (event.key === "ArrowUp") viewportControls.panView(0, -1, speed);
        if (event.key === "ArrowDown") viewportControls.panView(0, 1, speed);
      }
    };
    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.key === " ") releaseHand();
    };
    const handleWheel = (event: WheelEvent) => {
      const surface = surfaceRef.current;
      if (!surface) return;
      const rect = surface.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const point = displayPointToNormalized(event.clientX, event.clientY, rect);
        viewportControls.zoomByWheel(event.deltaY, {
          x: point.x * session.source.width,
          y: point.y * session.source.height,
        });
      } else {
        viewportControls.panBySourcePixels(
          (event.deltaX / rect.width) * session.source.width,
          (event.deltaY / rect.height) * session.source.height,
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", releaseHand);
    editor.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", releaseHand);
      editor.removeEventListener("wheel", handleWheel);
    };
  }, [session.source.height, session.source.width, surfaceRef, viewportControls]);

  const renderStroke = (stroke: {
    id: string;
    mode: GuidedBrushMode;
    points: readonly Point[];
    radius: number;
  }) => {
    const color = stroke.mode === "keep" ? "#16a34a" : "#e11d48";
    const coreRadius = guidedBrushHardCoreRadius(stroke.radius);
    const first = stroke.points[0];
    if (!first) return null;
    return (
      <g key={stroke.id}>
        <polyline
          data-testid="guided-brush-stroke-halo"
          points={strokePoints(
            stroke.points,
            session.source.width,
            session.source.height,
          )}
          fill="none"
          stroke={color}
          strokeOpacity="0.2"
          strokeWidth={stroke.radius * 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          data-testid="guided-brush-stroke-core"
          points={strokePoints(
            stroke.points,
            session.source.width,
            session.source.height,
          )}
          fill="none"
          stroke={color}
          strokeOpacity="0.68"
          strokeWidth={coreRadius * 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {stroke.points.length === 1 && (
          <>
            <circle
              cx={first.x * session.source.width}
              cy={first.y * session.source.height}
              r={stroke.radius}
              fill={color}
              fillOpacity="0.2"
            />
            <circle
              cx={first.x * session.source.width}
              cy={first.y * session.source.height}
              r={coreRadius}
              fill={color}
              fillOpacity="0.68"
            />
          </>
        )}
      </g>
    );
  };

  return (
    <section
      ref={viewportRef}
      role="application"
      aria-label={m.cutoutMagicStage()}
      className="relative size-full min-h-72 overflow-hidden rounded-xl bg-muted/40 focus-within:ring-3 focus-within:ring-ring/50"
      data-testid="guided-brush-selection"
      data-stroke-count={session.strokes.length}
      data-keep-stroke-count={
        session.strokes.filter((stroke) => stroke.mode === "keep").length
      }
      data-prompt-count={props.promptCounts?.total ?? undefined}
      data-prompt-keep-count={props.promptCounts?.keep ?? undefined}
      data-prompt-remove-count={props.promptCounts?.remove ?? undefined}
      data-zoom={viewportControls.zoomPercent}
    >
      <div
        className="grid size-full place-items-center"
        style={{
          transform: `scale(${String(viewportControls.viewport.zoom)}) translate(${String(
            (-viewportControls.viewport.offsetX / session.source.width) * 100,
          )}%, ${String(
            (-viewportControls.viewport.offsetY / session.source.height) * 100,
          )}%)`,
          transformOrigin: "top left",
        }}
      >
        <GuidedBrushBasePreview
          source={session.source}
          baseMatteRef={props.baseMatteRef}
          baseMatteRevision={props.baseMatteRevision}
          showProcessedBase={processedBase}
          busy={busy}
          interactionReady={interactionReady}
          surfaceRef={surfaceRef}
          onPointerDown={onPointerDown}
          onPointerEnter={(event) => {
            cacheInteractionRect(event.currentTarget);
            moveCursor(pointFor(event.clientX, event.clientY));
          }}
          onPointerMove={onPointerMove}
          onPointerUp={finishGesture}
          onPointerCancel={cancelGesture}
          onPointerLeave={() => {
            if (!draftRef.current.length && !panningRef.current)
              interactionRectRef.current = null;
            if (cursorRef.current) cursorRef.current.style.opacity = "0";
            if (coreCursorRef.current) coreCursorRef.current.style.opacity = "0";
          }}
          onKeyDown={onKeyDown}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
            viewBox={`0 0 ${String(session.source.width)} ${String(session.source.height)}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {session.strokes.map(renderStroke)}
            <g data-testid="guided-brush-draft">
              <polyline
                ref={draftHaloPolylineRef}
                points=""
                fill="none"
                stroke={mode === "keep" ? "#16a34a" : "#e11d48"}
                strokeOpacity="0.2"
                strokeWidth={session.brushRadius * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                ref={draftCorePolylineRef}
                points=""
                fill="none"
                stroke={mode === "keep" ? "#16a34a" : "#e11d48"}
                strokeOpacity="0.68"
                strokeWidth={guidedBrushHardCoreRadius(session.brushRadius) * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            <circle
              ref={cursorRef}
              data-testid="guided-brush-cursor"
              cx={0}
              cy={0}
              r={session.brushRadius}
              fill={mode === "keep" ? "#16a34a" : "#e11d48"}
              fillOpacity="0.14"
              stroke={mode === "keep" ? "#166534" : "#9f1239"}
              strokeWidth={Math.max(1, session.source.width / 500)}
              vectorEffect="non-scaling-stroke"
              style={{ opacity: 0 }}
            />
            <circle
              ref={coreCursorRef}
              data-testid="guided-brush-core-cursor"
              cx={0}
              cy={0}
              r={guidedBrushHardCoreRadius(session.brushRadius)}
              fill={mode === "keep" ? "#16a34a" : "#e11d48"}
              fillOpacity="0.52"
              stroke={mode === "keep" ? "#166534" : "#9f1239"}
              strokeWidth={Math.max(1, session.source.width / 500)}
              vectorEffect="non-scaling-stroke"
              style={{ opacity: 0 }}
            />
          </svg>
          {(busy || spacePanning || panning) && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              data-testid={busy ? "guided-brush-busy-overlay" : "guided-brush-pan-state"}
            />
          )}
        </GuidedBrushBasePreview>
      </div>
      <p id="guided-brush-status" role="status" className="sr-only">
        {busy ? m.cutoutApplying() : m.cutoutMagicReady()}
      </p>
    </section>
  );
}
