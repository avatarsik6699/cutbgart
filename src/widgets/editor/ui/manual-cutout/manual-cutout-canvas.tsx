import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { m } from "@/paraglide/messages";
import { EditorStage } from "@/shared/ui";

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
import { CanvasViewControls, type CanvasInteractionMode } from "../editor-tools";
import type { ManualCutoutInteraction } from "./manual-cutout-workspace";

const MANUAL_BRUSH_HARDNESS = 1;

function manualPointerIntent(
  input: Readonly<{
    button: number;
    editable: boolean;
    interactionMode: CanvasInteractionMode;
    spacePanning: boolean;
  }>,
): "ignore" | "paint" | "pan" {
  if (!input.editable) return "ignore";
  const panRequested = input.interactionMode === "hand" || input.spacePanning;
  if (panRequested && (input.button === 0 || input.button === 1)) return "pan";
  return input.button === 0 ? "paint" : "ignore";
}

export function ManualCutoutCanvas({
  backgroundUrl,
  busy,
  currentUrl,
  documentId,
  height,
  interaction,
  onCursorElementChange,
  width,
}: Readonly<{
  backgroundUrl: string | null;
  busy: boolean;
  currentUrl: string;
  documentId: string;
  height: number;
  interaction: ManualCutoutInteraction;
  onCursorElementChange(element: HTMLSpanElement | null): void;
  width: number;
}>) {
  const initialView = interaction.readViewState();
  const [zoom, setZoom] = useState(initialView.zoom);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>("brush");
  const [panController] = useState(() => new CutoutStagePanController(initialView.zoom));
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewControlsCollapsed, setViewControlsCollapsed] = useState(false);
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const draftState = interaction.snapshot();
  const connectContent = useCallback(
    (element: HTMLDivElement | null) => panController.connect(element),
    [panController],
  );
  const connectViewport = useCallback(
    (element: HTMLDivElement | null) => {
      viewportRef.current = element;
      connectViewportActivity(element);
    },
    [connectViewportActivity],
  );
  const connectCursor = useCallback(
    (element: HTMLSpanElement | null) => {
      cursorRef.current = element;
      onCursorElementChange(element);
    },
    [onCursorElementChange],
  );

  function writeZoom(nextZoom: number): void {
    const current = interaction.readViewState();
    interaction.writeViewState({ ...current, zoom: nextZoom });
  }

  function changeZoom(update: (zoom: number) => number): void {
    setZoom((currentZoom) => {
      const nextZoom = update(currentZoom);
      panController.setZoom(nextZoom);
      writeZoom(nextZoom);
      return nextZoom;
    });
  }

  function sourcePoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * width,
      y: ((event.clientY - box.top) / box.height) * height,
    };
  }

  function positionCursor(point: Readonly<{ x: number; y: number }>): void {
    const cursor = cursorRef.current;
    if (cursor === null) return;
    const view = interaction.readViewState();
    cursor.style.left = `${(point.x / width) * 100}%`;
    cursor.style.top = `${(point.y / height) * 100}%`;
    cursor.style.width = `${(view.brushSize * 100) / width}%`;
    cursor.style.height = `${(view.brushSize * 100) / height}%`;
    cursor.style.backgroundColor = CUTOUT_BRUSH_CURSOR_FILL_COLOR[view.mode];
    cursor.dataset.brushMode = view.mode;
    cursor.hidden = false;
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const intent = manualPointerIntent({
      button: event.button,
      editable: draftState !== null && !busy,
      interactionMode,
      spacePanning: panGesture.isSpacePressed() || event.button === 1,
    });
    if (intent === "ignore") return;
    if (intent === "pan") {
      event.preventDefault();
      panController.start(event);
      panGesture.setPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      if (cursorRef.current !== null) cursorRef.current.hidden = true;
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const view = interaction.readViewState();
    interaction.begin(sourcePoint(event), {
      mode: view.mode,
      radius: view.brushSize / 2,
      hardness: MANUAL_BRUSH_HARDNESS,
    });
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (panController.move(event)) return;
    const point = sourcePoint(event);
    if (interactionMode === "brush" && !panGesture.isSpacePressed())
      positionCursor(point);
    if (draftState === null || !event.currentTarget.hasPointerCapture(event.pointerId))
      return;
    const view = interaction.readViewState();
    interaction.move(point, {
      mode: view.mode,
      radius: view.brushSize / 2,
      hardness: MANUAL_BRUSH_HARDNESS,
    });
  }

  function pointerUp(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (panController.stop(event.pointerId)) {
      panGesture.setPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (draftState === null || !event.currentTarget.hasPointerCapture(event.pointerId))
      return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    interaction.end();
  }

  function pointerCancel(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (panController.stop(event.pointerId)) {
      panGesture.setPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (draftState === null) return;
    interaction.cancelGesture();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  useEffect(
    function loadManualSourceFx() {
      const canvas = canvasRef.current;
      if (canvas === null || draftState === null) return;
      return interaction.connectCanvas(canvas, currentUrl, width, height);
    },
    [currentUrl, draftState, height, interaction, width],
  );

  useEffect(
    function guardDirtyDraftUnloadFx() {
      function beforeUnloadFx(event: BeforeUnloadEvent): void {
        if (interaction.snapshot()?.dirty !== true) return;
        event.preventDefault();
        event.returnValue = "";
      }
      globalThis.addEventListener("beforeunload", beforeUnloadFx);
      return function removeManualDraftGuardsFx() {
        globalThis.removeEventListener("beforeunload", beforeUnloadFx);
      };
    },
    [interaction],
  );

  if (draftState === null) return null;

  return (
    <div className="[grid-area:surface] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <EditorStage
        documentId={documentId}
        loading={busy}
        loadingLabel={m.editorManualApplying()}
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
              writeZoom(1);
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
          aria-label={m.editorManualViewport()}
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
            style={{
              ...cutoutStageContentStyle(width, height),
              ...(backgroundUrl === null
                ? {}
                : {
                    backgroundImage: `url("${backgroundUrl.replaceAll('"', '\\"')}")`,
                    backgroundSize: "100% 100%",
                  }),
            }}
          >
            <canvas
              role="img"
              ref={canvasRef}
              data-cutout-canvas
              width={width}
              height={height}
              className="block size-full touch-none select-none"
              style={{ cursor: interactionMode === "hand" ? "grab" : "none" }}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerCancel}
              onPointerLeave={() => {
                if (cursorRef.current !== null) cursorRef.current.hidden = true;
              }}
              aria-label={m.editorManualCanvas()}
            />
            <span
              ref={connectCursor}
              data-brush-cursor
              data-testid="manual-brush-cursor"
              data-brush-mode={initialView.mode}
              hidden
              aria-hidden="true"
              className="pointer-events-none absolute rounded-full"
              style={{
                width: `${(initialView.brushSize * 100) / width}%`,
                height: `${(initialView.brushSize * 100) / height}%`,
                transform: "translate(-50%, -50%)",
                backgroundColor: CUTOUT_BRUSH_CURSOR_FILL_COLOR[initialView.mode],
              }}
            />
          </div>
        </div>
      </EditorStage>
    </div>
  );
}
