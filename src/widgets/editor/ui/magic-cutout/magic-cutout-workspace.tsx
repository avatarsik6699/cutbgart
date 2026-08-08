import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { m } from "@/paraglide/messages";
import { EditorStage, Image } from "@/shared/ui";
import type { MagicCutoutTypes } from "@/editor/domain";
import type { MagicRuntimeProgress } from "@/editor/runtime";
import { CanvasViewControls, type CanvasInteractionMode } from "../editor-tools";
import {
  CUTOUT_BRUSH_CURSOR_FILL_COLOR,
  CUTOUT_STAGE_CONTENT_CLASS_NAME,
  CUTOUT_STAGE_VIEWPORT_CLASS_NAME,
  CanvasWorkspaceActiveIndicator,
  CutoutStagePanController,
  cutoutStageContentStyle,
  useCanvasViewportActivity,
  useCutoutStagePanGesture,
} from "../cutout-stage";
import { MagicCutoutPanel } from "./magic-cutout-panel";

export type MagicCutoutInteraction = Readonly<{
  apply(): void;
  appendPoint(point: Readonly<{ x: number; y: number }>): void;
  beginStroke(
    input: Readonly<{
      id: string;
      mode: MagicCutoutTypes.Mode;
      point: Readonly<{ x: number; y: number }>;
      radius: number;
    }>,
  ): boolean;
  cancel(): void;
  cancelStroke(): void;
  commitStroke(): boolean;
  displayStrokes(): readonly Readonly<{
    id: string;
    mode: MagicCutoutTypes.Mode;
    points: readonly Readonly<{ x: number; y: number }>[];
    radius: number;
  }>[];
  readViewState(): Readonly<{ mode: MagicCutoutTypes.Mode; radius: number }>;
  redo(): void;
  snapshot(): Readonly<{
    canRedo: boolean;
    canUndo: boolean;
    strokeCount: number;
  }> | null;
  undo(): void;
  writeViewState(state: Readonly<{ mode: MagicCutoutTypes.Mode; radius: number }>): void;
}>;

type DisplayStroke = ReturnType<MagicCutoutInteraction["displayStrokes"]>[number];

function magicWorkspaceBusy(
  draft: MagicCutoutTypes.Draft,
  runtimeProgress: MagicRuntimeProgress | null,
  applying: boolean,
): boolean {
  return (
    applying ||
    runtimeProgress !== null ||
    draft.status === "encoding" ||
    draft.status === "predicting"
  );
}

function magicWorkspaceLoadingLabel(applying: boolean): string {
  return applying ? m.editorMagicApplying() : m.editorMagicWorking();
}

function paintStroke(
  context: CanvasRenderingContext2D,
  stroke: DisplayStroke,
  scaleX: number,
  scaleY: number,
): void {
  const first = stroke.points[0];
  if (first === undefined) return;
  context.beginPath();
  context.moveTo(first.x * scaleX, first.y * scaleY);
  for (let index = 1; index < stroke.points.length; index += 1) {
    const point = stroke.points[index];
    if (point !== undefined) context.lineTo(point.x * scaleX, point.y * scaleY);
  }
  context.strokeStyle = stroke.mode === "keep" ? "#22c55e" : "#ef4444";
  context.globalAlpha = 0.78;
  context.lineWidth = stroke.radius * 2 * scaleX;
  context.stroke();
  if (stroke.points.length !== 1) return;
  context.beginPath();
  context.arc(first.x * scaleX, first.y * scaleY, stroke.radius * scaleX, 0, Math.PI * 2);
  context.fillStyle = context.strokeStyle;
  context.fill();
}

export function MagicCutoutWorkspace(
  props: Readonly<{
    applying: boolean;
    draft: MagicCutoutTypes.Draft;
    height: number;
    runtimeProgress: MagicRuntimeProgress | null;
    interaction: MagicCutoutInteraction;
    currentUrl: string;
    width: number;
    onCutoutModeChange?(mode: "magic" | "manual"): void;
  }>,
) {
  const initialView = props.interaction.readViewState();
  const [mode, setMode] = useState<MagicCutoutTypes.Mode>(initialView.mode);
  const radiusRef = useRef(initialView.radius);
  const [zoom, setZoom] = useState(1);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>("brush");
  const [panController] = useState(() => new CutoutStagePanController(1));
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewControlsCollapsed, setViewControlsCollapsed] = useState(false);
  const busy = magicWorkspaceBusy(props.draft, props.runtimeProgress, props.applying);
  const {
    active: viewportActive,
    connectViewport: connectViewportActivity,
    isActive: isViewportActive,
    onBlur: onViewportBlur,
    onFocus: onViewportFocus,
    onPointerEnter: onViewportPointerEnter,
    onPointerLeave: onViewportPointerLeave,
  } = useCanvasViewportActivity({
    disabled: busy,
    onZoomIn: () => changeZoom((value) => Math.min(3, value + 0.25)),
    onZoomOut: () => changeZoom((value) => Math.max(0.5, value - 0.25)),
  });
  const panGesture = useCutoutStagePanGesture({
    disabled: busy,
    interactionMode,
    isViewportActive,
    panController,
    viewportRef,
  });

  function changeMode(nextMode: MagicCutoutTypes.Mode): void {
    setMode(nextMode);
    props.interaction.writeViewState({ mode: nextMode, radius: radiusRef.current });
  }

  function changeRadius(nextRadius: number): void {
    radiusRef.current = nextRadius;
    const cursor = cursorRef.current;
    if (cursor !== null) {
      cursor.style.width = `${(nextRadius * 2 * 100) / props.width}%`;
      cursor.style.height = `${(nextRadius * 2 * 100) / props.height}%`;
    }
    props.interaction.writeViewState({ mode, radius: nextRadius });
  }
  const strokeCanvas = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const activePointer = useRef<number | null>(null);
  const paintFrame = useRef<number | null>(null);
  const strokeSequence = useRef(0);

  const connectContent = useCallback(
    function connectMagicStageContent(element: HTMLDivElement | null): void {
      panController.connect(element);
    },
    [panController],
  );
  const connectViewport = useCallback(
    function connectMagicViewport(element: HTMLDivElement | null): void {
      viewportRef.current = element;
      connectViewportActivity(element);
    },
    [connectViewportActivity],
  );

  function changeZoom(update: (zoom: number) => number): void {
    setZoom((currentZoom) => {
      const nextZoom = update(currentZoom);
      panController.setZoom(nextZoom);
      return nextZoom;
    });
  }

  function beginPan(event: ReactPointerEvent<HTMLCanvasElement>): boolean {
    const handGesture =
      interactionMode === "hand" || panGesture.isSpacePressed() || event.button === 1;
    if (!handGesture || (event.button !== 0 && event.button !== 1)) return false;
    event.preventDefault();
    panController.start(event);
    panGesture.setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    return true;
  }

  function movePan(event: ReactPointerEvent<HTMLCanvasElement>): boolean {
    return panController.move(event);
  }

  function endPan(event: ReactPointerEvent<HTMLCanvasElement>): boolean {
    if (!panController.stop(event.pointerId)) return false;
    panGesture.setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    return true;
  }

  function sourcePoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * props.width,
      y: ((event.clientY - rect.top) / rect.height) * props.height,
    };
  }

  function paintStrokesFx(): void {
    const canvas = strokeCanvas.current;
    if (canvas === null) return;
    const scale = Math.min(1, 1600 / Math.max(props.width, props.height));
    const canvasWidth = Math.max(1, Math.round(props.width * scale));
    const canvasHeight = Math.max(1, Math.round(props.height * scale));
    if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
    if (canvas.height !== canvasHeight) canvas.height = canvasHeight;
    const context = canvas.getContext("2d");
    if (context === null) return;
    const scaleX = canvas.width / props.width;
    const scaleY = canvas.height / props.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of props.interaction.displayStrokes())
      paintStroke(context, stroke, scaleX, scaleY);
    context.globalAlpha = 1;
  }

  function scheduleStrokePaint(): void {
    if (paintFrame.current !== null) return;
    if (typeof globalThis.requestAnimationFrame !== "function") {
      paintStrokesFx();
      return;
    }
    paintFrame.current = globalThis.requestAnimationFrame(function paintMagicFrameFx() {
      paintFrame.current = null;
      paintStrokesFx();
    });
  }

  function positionCursor(point: Readonly<{ x: number; y: number }>): void {
    const cursor = cursorRef.current;
    if (cursor === null) return;
    cursor.style.left = `${(point.x / props.width) * 100}%`;
    cursor.style.top = `${(point.y / props.height) * 100}%`;
    cursor.hidden = false;
  }

  useEffect(paintStrokesFx, [
    props.draft.draftRevision,
    props.height,
    props.interaction,
    props.width,
  ]);

  useEffect(function cancelScheduledMagicPaintFx() {
    return () => {
      if (
        paintFrame.current !== null &&
        typeof globalThis.cancelAnimationFrame === "function"
      )
        globalThis.cancelAnimationFrame(paintFrame.current);
    };
  }, []);

  useEffect(
    function guardDirtyMagicDraftUnloadFx() {
      function beforeUnloadFx(event: BeforeUnloadEvent): void {
        if (!props.draft.dirty) return;
        event.preventDefault();
        event.returnValue = "";
      }
      globalThis.addEventListener("beforeunload", beforeUnloadFx);
      return function removeMagicDraftGuardsFx() {
        globalThis.removeEventListener("beforeunload", beforeUnloadFx);
      };
    },
    [props.draft.dirty, props.interaction],
  );

  function pointerDownFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (activePointer.current !== null || busy) return;
    if (beginPan(event)) {
      if (cursorRef.current !== null) cursorRef.current.hidden = true;
      return;
    }
    const point = sourcePoint(event);
    const started = props.interaction.beginStroke({
      id: `magic-stroke-${++strokeSequence.current}`,
      mode,
      point,
      radius: radiusRef.current,
    });
    if (!started) return;
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    positionCursor(point);
    scheduleStrokePaint();
  }

  function pointerMoveFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (movePan(event)) return;
    const point = sourcePoint(event);
    if (interactionMode === "brush" && !panGesture.isSpacePressed())
      positionCursor(point);
    if (activePointer.current === event.pointerId) {
      props.interaction.appendPoint(point);
      scheduleStrokePaint();
    }
  }

  function pointerUpFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (endPan(event)) return;
    if (activePointer.current !== event.pointerId) return;
    props.interaction.appendPoint(sourcePoint(event));
    props.interaction.commitStroke();
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    scheduleStrokePaint();
  }

  function pointerCancelFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (endPan(event)) return;
    if (activePointer.current !== event.pointerId) return;
    props.interaction.cancelStroke();
    activePointer.current = null;
    scheduleStrokePaint();
  }

  function lostPointerCaptureFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (endPan(event)) return;
    if (activePointer.current !== event.pointerId) return;
    props.interaction.cancelStroke();
    activePointer.current = null;
    scheduleStrokePaint();
  }

  return (
    <>
      <div className="[grid-area:surface] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        <EditorStage
          documentId={props.draft.documentId}
          loading={busy}
          loadingLabel={magicWorkspaceLoadingLabel(props.applying)}
          OverlaySlot={({ expanded, toggleFullscreen }) => (
            <CanvasViewControls
              interactionMode={interactionMode}
              onInteractionModeChange={setInteractionMode}
              zoomPercent={Math.round(zoom * 100)}
              canZoomIn={zoom < 3}
              canZoomOut={zoom > 0.5}
              canPan
              onZoomIn={() => changeZoom((value) => Math.min(3, value + 0.25))}
              onZoomOut={() => changeZoom((value) => Math.max(0.5, value - 0.25))}
              onResetView={() => {
                panController.reset();
                setZoom(1);
              }}
              expanded={expanded}
              onToggleFullscreen={toggleFullscreen}
              collapsed={viewControlsCollapsed}
              onCollapsedChange={setViewControlsCollapsed}
              shortcutsActive={viewportActive}
            />
          )}
        >
          <div
            className={CUTOUT_STAGE_VIEWPORT_CLASS_NAME}
            ref={connectViewport}
            tabIndex={0}
            aria-label={m.editorMagicTitle()}
            data-workspace-active={viewportActive}
            data-testid="cutout-stage-viewport"
            data-space-panning="false"
            data-panning="false"
            data-zoom={zoom}
            onBlur={onViewportBlur}
            onFocus={onViewportFocus}
            onPointerEnter={onViewportPointerEnter}
            onPointerLeave={onViewportPointerLeave}
          >
            <CanvasWorkspaceActiveIndicator active={viewportActive} />
            <div
              ref={connectContent}
              className={CUTOUT_STAGE_CONTENT_CLASS_NAME}
              data-testid="cutout-stage-content"
              data-tool-image-viewport="true"
              style={cutoutStageContentStyle(props.width, props.height)}
            >
              <Image
                src={props.currentUrl}
                alt={m.editorResultAlt()}
                preset="preview"
                width={props.width}
                height={props.height}
                className="absolute inset-0 size-full object-contain"
              />
              <canvas
                ref={strokeCanvas}
                data-cutout-canvas
                className="absolute inset-0 block h-full w-full touch-none"
                style={{ cursor: interactionMode === "hand" ? "grab" : "none" }}
                aria-label={m.editorMagicCanvas()}
                onPointerDown={pointerDownFx}
                onPointerMove={pointerMoveFx}
                onPointerUp={pointerUpFx}
                onPointerCancel={pointerCancelFx}
                onLostPointerCapture={lostPointerCaptureFx}
                onPointerLeave={() => {
                  if (cursorRef.current !== null) cursorRef.current.hidden = true;
                }}
              />
              <span
                ref={cursorRef}
                data-brush-cursor
                data-testid="magic-brush-cursor"
                data-brush-mode={mode}
                hidden
                aria-hidden="true"
                className="pointer-events-none absolute rounded-full"
                style={{
                  width: `${(initialView.radius * 2 * 100) / props.width}%`,
                  height: `${(initialView.radius * 2 * 100) / props.height}%`,
                  transform: "translate(-50%, -50%)",
                  backgroundColor: CUTOUT_BRUSH_CURSOR_FILL_COLOR[mode],
                }}
              />
            </div>
          </div>
        </EditorStage>
      </div>
      <MagicCutoutPanel
        busy={busy}
        draft={props.draft}
        initialRadius={initialView.radius}
        interaction={props.interaction}
        mode={mode}
        onCutoutModeChange={props.onCutoutModeChange}
        onModeChange={changeMode}
        onRadiusChange={changeRadius}
        runtimeProgress={props.runtimeProgress}
      />
    </>
  );
}
