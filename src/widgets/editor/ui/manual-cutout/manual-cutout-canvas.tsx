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
  CUTOUT_STAGE_CONTENT_CLASS_NAME,
  CUTOUT_STAGE_VIEWPORT_CLASS_NAME,
  CutoutStagePanController,
  cutoutStageContentStyle,
  isEditableCanvasShortcutTarget,
} from "../cutout-stage";
import { CanvasViewControls, type CanvasInteractionMode } from "../editor-tools";
import type { ManualCutoutInteraction } from "./manual-cutout-workspace";

export function ManualCutoutCanvas({
  currentUrl,
  documentId,
  height,
  interaction,
  onCursorElementChange,
  width,
}: Readonly<{
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
  const [spacePanning, setSpacePanning] = useState(false);
  const [panning, setPanning] = useState(false);
  const [panController] = useState(() => new CutoutStagePanController(initialView.zoom));
  const [viewControlsCollapsed, setViewControlsCollapsed] = useState(false);
  const spacePanningRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const draftState = interaction.snapshot();
  const connectContent = useCallback(
    (element: HTMLDivElement | null) => panController.connect(element),
    [panController],
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
    const brushSize = interaction.readViewState().brushSize;
    cursor.style.left = `${(point.x / width) * 100}%`;
    cursor.style.top = `${(point.y / height) * 100}%`;
    cursor.style.width = `${(brushSize * 100) / width}%`;
    cursor.style.height = `${(brushSize * 100) / height}%`;
    cursor.hidden = false;
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (draftState === null) return;
    const handGesture =
      interactionMode === "hand" || spacePanningRef.current || event.button === 1;
    if (handGesture && (event.button === 0 || event.button === 1)) {
      event.preventDefault();
      panController.start(event);
      setPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      if (cursorRef.current !== null) cursorRef.current.hidden = true;
      return;
    }
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const view = interaction.readViewState();
    interaction.begin(sourcePoint(event), {
      mode: view.mode,
      radius: view.brushSize / 2,
      hardness: 0.72,
    });
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (panController.move(event)) return;
    const point = sourcePoint(event);
    if (interactionMode === "brush" && !spacePanning) positionCursor(point);
    if (draftState === null || !event.currentTarget.hasPointerCapture(event.pointerId))
      return;
    const view = interaction.readViewState();
    interaction.move(point, {
      mode: view.mode,
      radius: view.brushSize / 2,
      hardness: 0.72,
    });
  }

  function pointerUp(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (panController.stop(event.pointerId)) {
      setPanning(false);
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
      setPanning(false);
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

  useEffect(
    function routeManualSpacePanFx() {
      function releaseSpacePanFx(event?: KeyboardEvent): void {
        if (event !== undefined && event.key !== " ") return;
        spacePanningRef.current = false;
        setSpacePanning(false);
        panController.stop();
        setPanning(false);
      }
      function keyDownFx(event: KeyboardEvent): void {
        if (
          event.key !== " " ||
          event.repeat ||
          isEditableCanvasShortcutTarget(event.target)
        )
          return;
        event.preventDefault();
        spacePanningRef.current = true;
        setSpacePanning(true);
      }
      const keyUpFx = (event: KeyboardEvent) => releaseSpacePanFx(event);
      const blurFx = () => releaseSpacePanFx();
      globalThis.addEventListener("keydown", keyDownFx);
      globalThis.addEventListener("keyup", keyUpFx);
      globalThis.addEventListener("blur", blurFx);
      return function removeManualSpacePanFx() {
        globalThis.removeEventListener("keydown", keyDownFx);
        globalThis.removeEventListener("keyup", keyUpFx);
        globalThis.removeEventListener("blur", blurFx);
      };
    },
    [panController],
  );

  if (draftState === null) return null;
  let cursorClassName = "cursor-none";
  if (interactionMode === "hand" || spacePanning)
    cursorClassName = panning ? "cursor-grabbing" : "cursor-grab";

  return (
    <div className="[grid-area:surface]">
      <EditorStage
        documentId={documentId}
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
          />
        )}
      >
        <div
          className={CUTOUT_STAGE_VIEWPORT_CLASS_NAME}
          tabIndex={0}
          aria-label={m.editorManualViewport()}
          data-testid="cutout-stage-viewport"
          data-space-panning={spacePanning}
          data-panning={panning}
          data-zoom={zoom}
        >
          <div
            ref={connectContent}
            className={CUTOUT_STAGE_CONTENT_CLASS_NAME}
            data-testid="cutout-stage-content"
            data-tool-image-viewport="true"
            style={cutoutStageContentStyle(width, height)}
          >
            <canvas
              role="img"
              ref={canvasRef}
              width={width}
              height={height}
              className={`block size-full touch-none select-none ${cursorClassName}`}
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
              data-testid="manual-brush-cursor"
              hidden
              aria-hidden="true"
              className="pointer-events-none absolute rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.8)]"
              style={{
                width: `${(initialView.brushSize * 100) / width}%`,
                height: `${(initialView.brushSize * 100) / height}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
        </div>
      </EditorStage>
    </div>
  );
}
