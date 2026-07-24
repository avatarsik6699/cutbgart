import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

import { m } from "@/paraglide/messages";
import type { AlphaMatte } from "../../../entities/processed-image";
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
import { GuidedBrushControls } from "./GuidedBrushControls";
import { GuidedBrushBasePreview } from "./GuidedBrushBasePreview";
import { GuidedBrushResultPreview } from "./GuidedBrushResultPreview";

interface Point {
  x: number;
  y: number;
}

interface Props {
  session: GuidedBrushViewSession;
  status: GuidedBrushStatus;
  matteRef: RefObject<AlphaMatte | null>;
  matteRevision: number | string;
  baseMatteRef: RefObject<AlphaMatte | null>;
  baseMatteRevision: number | string | null;
  entryKind: "direct" | "processed";
  resultColorSource: Blob;
  hasMatte: boolean;
  progress: number | null;
  error?: string | null;
  errorCode?: "keep-required" | "marking-required" | "worker-failed" | null;
  promptCounts?: {
    total: number | null;
    keep: number | null;
    remove: number | null;
  };
  applying?: boolean;
  canAccept: boolean;
  onStroke: (stroke: {
    mode: GuidedBrushMode;
    points: readonly Point[];
    radius?: number;
  }) => void;
  onBrushRadiusChange: (radius: number) => void;
  onSelectCandidate: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onRecompute: () => void;
  onContinueFromResult: () => void;
  onAccept: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

function strokePoints(points: readonly Point[], width: number, height: number): string {
  return points
    .map((point) => `${String(point.x * width)},${String(point.y * height)}`)
    .join(" ");
}

export function GuidedBrushCanvas(props: Props) {
  const { session, status, matteRef, matteRevision, progress, error, onUndo, onRedo } =
    props;
  const [mode, setMode] = useState<GuidedBrushMode>("keep");
  const [activePane, setActivePane] = useState<"markings" | "result">("markings");
  const previousComputedRevisionRef = useRef(session.computedRevision);
  const draftRef = useRef<Point[]>([]);
  const draftHaloPolylineRef = useRef<SVGPolylineElement>(null);
  const draftCorePolylineRef = useRef<SVGPolylineElement>(null);
  const cursorRef = useRef<SVGCircleElement>(null);
  const coreCursorRef = useRef<SVGCircleElement>(null);
  const surfaceRef = useRef<HTMLCanvasElement>(null);
  const interactionRectRef = useRef<DOMRect | null>(null);
  const busy =
    props.applying ||
    status === "loading-model" ||
    status === "encoding-image" ||
    status === "predicting";
  const interactionReady = status !== "loading-model" && status !== "encoding-image";
  const processedBase = props.entryKind === "processed" && session.hasBaseMatte;
  const markingsLabel = processedBase
    ? m.guidedBrushBaseAndMarkingsTab()
    : m.guidedBrushMarkingsTab();
  const resultStale =
    props.hasMatte &&
    session.computedRevision !== null &&
    session.computedRevision !== session.revision;

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
    const previous = previousComputedRevisionRef.current;
    previousComputedRevisionRef.current = session.computedRevision;
    if (
      session.candidates.length > 0 &&
      session.computedRevision !== null &&
      session.computedRevision !== previous
    )
      setActivePane("result");
  }, [session.candidates.length, session.computedRevision]);

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
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
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
    ensureInteractionRect(event.currentTarget);
    const point = pointFor(event.clientX, event.clientY);
    moveCursor(point);
    if (!draftRef.current.length) return;
    appendDraftPoint(point);
  };
  const finishGesture = (event: PointerEvent<HTMLCanvasElement>) => {
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

  const statusText = props.applying
    ? m.guidedBrushApplying()
    : status === "loading-model"
      ? m.guidedLoadingModel({ progress: String(Math.round(progress ?? 0)) })
      : status === "encoding-image"
        ? m.guidedEncodingImage()
        : status === "predicting"
          ? m.guidedBrushRecomputing()
          : status === "preview"
            ? m.guidedBrushPreviewReady()
            : status === "dirty"
              ? m.guidedBrushDirty()
              : status === "error"
                ? props.errorCode === "keep-required"
                  ? m.guidedBrushKeepRequired()
                  : m.guidedBrushError()
                : m.guidedBrushReady();

  const renderStroke = (
    stroke: {
      id: string;
      mode: GuidedBrushMode;
      points: readonly Point[];
      radius: number;
    },
    draftStroke = false,
  ) => {
    const color = stroke.mode === "keep" ? "#16a34a" : "#e11d48";
    const coreRadius = guidedBrushHardCoreRadius(stroke.radius);
    const first = stroke.points[0];
    if (!first) return null;
    return (
      <g key={stroke.id} data-testid={draftStroke ? "guided-brush-draft" : undefined}>
        <polyline
          data-testid={draftStroke ? undefined : "guided-brush-stroke-halo"}
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
          data-testid={draftStroke ? undefined : "guided-brush-stroke-core"}
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
      className="space-y-4"
      aria-labelledby="guided-brush-title"
      data-testid="guided-brush-selection"
      data-stroke-count={session.strokes.length}
      data-keep-stroke-count={
        session.strokes.filter((stroke) => stroke.mode === "keep").length
      }
      data-prompt-count={props.promptCounts?.total ?? undefined}
      data-prompt-keep-count={props.promptCounts?.keep ?? undefined}
      data-prompt-remove-count={props.promptCounts?.remove ?? undefined}
    >
      <div>
        <h2 id="guided-brush-title" className="font-semibold">
          {m.guidedBrushTitle()}
        </h2>
        <p className="text-sm text-muted-foreground">{m.guidedBrushHint()}</p>
      </div>
      <GuidedBrushControls
        mode={mode}
        onModeChange={(mode) => {
          setMode(mode);
          const cursor = cursorRef.current;
          const coreCursor = coreCursorRef.current;
          if (!cursor || !coreCursor) return;
          const keep = mode === "keep";
          for (const circle of [cursor, coreCursor]) {
            circle.setAttribute("fill", keep ? "#16a34a" : "#e11d48");
            circle.setAttribute("stroke", keep ? "#166534" : "#9f1239");
          }
        }}
        session={session}
        status={status}
        applying={props.applying}
        canAccept={props.canAccept}
        onBrushRadiusChange={props.onBrushRadiusChange}
        onSelectCandidate={(id) => {
          setActivePane("result");
          props.onSelectCandidate(id);
        }}
        onUndo={props.onUndo}
        onRedo={props.onRedo}
        onClear={props.onClear}
        onRecompute={props.onRecompute}
        onContinueFromResult={() => {
          previousComputedRevisionRef.current = session.revision + 1;
          setActivePane("markings");
          props.onContinueFromResult();
        }}
        onAccept={props.onAccept}
        onRetry={props.onRetry}
        onCancel={props.onCancel}
      />
      <div
        className="grid grid-cols-2 rounded-lg bg-muted/50 p-1 lg:hidden"
        role="tablist"
        aria-label={m.guidedBrushTitle()}
      >
        {(["markings", "result"] as const).map((pane) => (
          <button
            key={pane}
            type="button"
            role="tab"
            id={`guided-brush-${pane}-tab`}
            aria-controls={`guided-brush-${pane}-panel`}
            aria-selected={activePane === pane}
            tabIndex={activePane === pane ? 0 : -1}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              activePane === pane
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
            onClick={() => setActivePane(pane)}
          >
            {pane === "markings" ? markingsLabel : m.guidedBrushResultTab()}
          </button>
        ))}
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:grid-rows-[auto_auto]">
        <section
          id="guided-brush-markings-panel"
          role="tabpanel"
          aria-labelledby="guided-brush-markings-tab"
          className={
            activePane === "markings"
              ? "min-w-0 space-y-2 lg:row-span-2 lg:grid lg:grid-rows-subgrid lg:gap-2 lg:space-y-0"
              : "hidden min-w-0 space-y-2 lg:row-span-2 lg:grid lg:grid-rows-subgrid lg:gap-2 lg:space-y-0"
          }
          data-testid="guided-brush-markings-pane"
        >
          <div>
            <h3 className="text-sm font-medium">{markingsLabel}</h3>
            <p className="text-xs text-muted-foreground">
              {processedBase
                ? m.guidedBrushAutomaticBaseHint()
                : m.guidedBrushMarkingsPaneHint()}
            </p>
            {processedBase && (
              <p
                className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"
                data-testid="guided-brush-removed-context-legend"
              >
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-sm border bg-foreground/15"
                />
                {m.guidedBrushRemovedContextLegend()}
              </p>
            )}
          </div>
          <div className="flex w-full items-start justify-center rounded-xl bg-muted/40">
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
                if (!draftRef.current.length) interactionRectRef.current = null;
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
                {session.strokes.map((stroke) => renderStroke(stroke))}
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
                  strokeDasharray={`${String(Math.max(3, session.source.width / 180))} ${String(Math.max(2, session.source.width / 260))}`}
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
              {busy && (
                <span
                  data-testid="guided-brush-busy-overlay"
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 grid place-items-center bg-background/25"
                >
                  <span className="size-8 animate-pulse rounded-full border-4 border-primary/35 border-t-primary" />
                </span>
              )}
            </GuidedBrushBasePreview>
          </div>
        </section>
        <section
          id="guided-brush-result-panel"
          role="tabpanel"
          aria-labelledby="guided-brush-result-tab"
          className={
            activePane === "result"
              ? "min-w-0 space-y-2 lg:row-span-2 lg:grid lg:grid-rows-subgrid lg:gap-2 lg:space-y-0"
              : "hidden min-w-0 space-y-2 lg:row-span-2 lg:grid lg:grid-rows-subgrid lg:gap-2 lg:space-y-0"
          }
          data-testid="guided-brush-result-pane"
        >
          <div>
            <h3 className="text-sm font-medium">{m.guidedBrushResultTab()}</h3>
            <div className="flex min-h-6 items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {m.guidedBrushResultPreviewHint()}
              </p>
              {resultStale && (
                <span
                  className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  data-testid="guided-brush-result-stale"
                >
                  {m.guidedBrushResultStale()}
                </span>
              )}
            </div>
          </div>
          <GuidedBrushResultPreview
            source={session.source}
            colorSource={props.resultColorSource}
            matteRef={matteRef}
            matteRevision={matteRevision}
            hasMatte={props.hasMatte}
          />
        </section>
      </div>
      <div id="guided-brush-status" className="space-y-2">
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
      </div>
    </section>
  );
}
