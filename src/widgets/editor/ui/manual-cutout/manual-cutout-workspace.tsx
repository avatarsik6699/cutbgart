import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CircleMinus, CirclePlus } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Button, EditorStage, Typography } from "@/shared/ui";
import type { DocumentHistoryTypes } from "@/editor/domain";
import {
  CanvasViewControls,
  ToolPanelSlot,
  type CanvasInteractionMode,
} from "../editor-tools";
import {
  CUTOUT_STAGE_VIEWPORT_CLASS_NAME,
  CutoutStagePanController,
  cutoutStageContentStyle,
  isEditableCanvasShortcutTarget,
} from "../cutout-stage";
import { CutoutModeTabs } from "../editor-tools/cutout-mode-tabs";

type Props = {
  documentId: string;
  height: number;
  interaction: ManualCutoutInteraction;
  currentUrl: string;
  width: number;
  onCutoutModeChange?(mode: "magic" | "manual"): void;
};

export type ManualCutoutInteraction = Readonly<{
  apply(): void;
  begin(
    point: Readonly<{ x: number; y: number }>,
    brush: Readonly<{
      mode: DocumentHistoryTypes.ManualMode;
      radius: number;
      hardness: number;
    }>,
  ): void;
  cancel(): void;
  cancelGesture(): void;
  connectCanvas(
    canvas: HTMLCanvasElement,
    sourceUrl: string,
    width: number,
    height: number,
  ): () => void;
  end(): void;
  move(
    point: Readonly<{ x: number; y: number }>,
    brush: Readonly<{
      mode: DocumentHistoryTypes.ManualMode;
      radius: number;
      hardness: number;
    }>,
  ): void;
  readViewState(): Readonly<{
    mode: DocumentHistoryTypes.ManualMode;
    brushSize: number;
    zoom: number;
  }>;
  writeViewState(
    state: Readonly<{
      mode: DocumentHistoryTypes.ManualMode;
      brushSize: number;
      zoom: number;
    }>,
  ): void;
  redo(): void;
  snapshot(): Readonly<{ canRedo: boolean; canUndo: boolean; dirty: boolean }> | null;
  undo(): void;
}>;

export function ManualCutoutWorkspace(props: Props) {
  const initialView = props.interaction.readViewState();
  const [mode, setMode] = useState<DocumentHistoryTypes.ManualMode>(initialView.mode);
  const brushSizeRef = useRef(initialView.brushSize);
  const [zoom, setZoom] = useState(initialView.zoom);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>("brush");
  const [spacePanning, setSpacePanning] = useState(false);
  const [panning, setPanning] = useState(false);
  const [panController] = useState(() => new CutoutStagePanController(initialView.zoom));
  const spacePanningRef = useRef(false);
  const [viewControlsCollapsed, setViewControlsCollapsed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const draftState = props.interaction.snapshot();

  const connectContent = useCallback(
    function connectManualStageContent(element: HTMLDivElement | null): void {
      panController.connect(element);
    },
    [panController],
  );

  function changeMode(nextMode: DocumentHistoryTypes.ManualMode): void {
    setMode(nextMode);
    props.interaction.writeViewState({
      mode: nextMode,
      brushSize: brushSizeRef.current,
      zoom,
    });
  }

  function changeBrushSize(nextBrushSize: number): void {
    brushSizeRef.current = nextBrushSize;
    const cursor = cursorRef.current;
    if (cursor !== null) {
      cursor.style.width = `${(nextBrushSize * 100) / props.width}%`;
      cursor.style.height = `${(nextBrushSize * 100) / props.height}%`;
    }
    props.interaction.writeViewState({
      mode,
      brushSize: nextBrushSize,
      zoom,
    });
  }

  function changeZoom(update: (zoom: number) => number): void {
    setZoom((currentZoom) => {
      const nextZoom = update(currentZoom);
      panController.setZoom(nextZoom);
      props.interaction.writeViewState({
        mode,
        brushSize: brushSizeRef.current,
        zoom: nextZoom,
      });
      return nextZoom;
    });
  }

  function sourcePoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * props.width,
      y: ((event.clientY - box.top) / box.height) * props.height,
    };
  }

  function positionCursor(point: Readonly<{ x: number; y: number }>): void {
    const cursor = cursorRef.current;
    if (cursor === null) return;
    cursor.style.left = `${(point.x / props.width) * 100}%`;
    cursor.style.top = `${(point.y / props.height) * 100}%`;
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
    const point = sourcePoint(event);
    props.interaction.begin(point, {
      mode,
      radius: brushSizeRef.current / 2,
      hardness: 0.72,
    });
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (panController.move(event)) return;
    const point = sourcePoint(event);
    if (interactionMode === "brush" && !spacePanning) positionCursor(point);
    if (draftState === null || !event.currentTarget.hasPointerCapture(event.pointerId))
      return;
    props.interaction.move(point, {
      mode,
      radius: brushSizeRef.current / 2,
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
    props.interaction.end();
  }

  function pointerCancel(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (panController.stop(event.pointerId)) {
      setPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (draftState === null) return;
    props.interaction.cancelGesture();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const undo = useCallback(
    function undoManualGesture(): void {
      props.interaction.undo();
    },
    [props.interaction],
  );

  const redo = useCallback(
    function redoManualGesture(): void {
      props.interaction.redo();
    },
    [props.interaction],
  );

  useEffect(
    function loadManualSourceFx() {
      const canvas = canvasRef.current;
      if (canvas === null || draftState === null) return;
      return props.interaction.connectCanvas(
        canvas,
        props.currentUrl,
        props.width,
        props.height,
      );
    },
    [draftState, props.currentUrl, props.height, props.interaction, props.width],
  );

  useEffect(
    function guardDirtyDraftNavigationFx() {
      function beforeUnloadFx(event: BeforeUnloadEvent): void {
        if (props.interaction.snapshot()?.dirty !== true) return;
        event.preventDefault();
        event.returnValue = "";
      }
      globalThis.addEventListener("beforeunload", beforeUnloadFx);
      return function removeManualUnloadGuardFx() {
        globalThis.removeEventListener("beforeunload", beforeUnloadFx);
      };
    },
    [props.interaction],
  );

  useEffect(
    function routeManualShortcutsFx() {
      function keyDownFx(event: KeyboardEvent): void {
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key.toLowerCase() !== "z" && event.key.toLowerCase() !== "y") return;
        event.preventDefault();
        if (event.key.toLowerCase() === "y" || event.shiftKey) redo();
        else undo();
      }
      globalThis.addEventListener("keydown", keyDownFx);
      return function removeManualShortcutsFx() {
        globalThis.removeEventListener("keydown", keyDownFx);
      };
    },
    [redo, undo],
  );

  useEffect(
    function routeManualSpacePanFx() {
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
      function releaseSpacePanFx(event?: KeyboardEvent): void {
        if (event !== undefined && event.key !== " ") return;
        spacePanningRef.current = false;
        setSpacePanning(false);
        panController.stop();
        setPanning(false);
      }
      function keyUpFx(event: KeyboardEvent): void {
        releaseSpacePanFx(event);
      }
      function blurFx(): void {
        releaseSpacePanFx();
      }
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

  let canvasCursorClassName = "cursor-none";
  if (interactionMode === "hand" || spacePanning)
    canvasCursorClassName = panning ? "cursor-grabbing" : "cursor-grab";

  return (
    <>
      <div className="[grid-area:surface]">
        <EditorStage
          documentId={props.documentId}
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
                props.interaction.writeViewState({
                  mode,
                  brushSize: brushSizeRef.current,
                  zoom: 1,
                });
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
              className="relative shrink-0"
              data-testid="cutout-stage-content"
              style={cutoutStageContentStyle(props.width, props.height)}
            >
              <canvas
                role="img"
                ref={canvasRef}
                width={props.width}
                height={props.height}
                className={`block size-full touch-none select-none ${canvasCursorClassName}`}
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
                ref={cursorRef}
                data-testid="manual-brush-cursor"
                hidden
                aria-hidden="true"
                className="pointer-events-none absolute rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.8)]"
                style={{
                  width: `${(initialView.brushSize * 100) / props.width}%`,
                  height: `${(initialView.brushSize * 100) / props.height}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>
          </div>
        </EditorStage>
      </div>
      <div className="[grid-area:rail]">
        <ToolPanelSlot toolId="cutout" label={m.editorManualWorkspace()} autoFocus>
          <section className="flex h-full min-h-0 flex-col gap-5">
            <CutoutModeTabs
              mode="manual"
              onModeChange={(mode) => props.onCutoutModeChange?.(mode)}
            />
            <div
              className="grid grid-cols-2 gap-2"
              role="toolbar"
              aria-label={m.editorManualMode()}
            >
              <Button
                variant={mode === "restore" ? "default" : "outline"}
                className={`h-20 flex-col gap-1.5 ${
                  mode === "restore"
                    ? "bg-emerald-700 text-white hover:bg-emerald-800"
                    : "border-emerald-700 text-emerald-800 dark:text-emerald-300"
                }`}
                onClick={() => changeMode("restore")}
              >
                <CirclePlus className="size-6" aria-hidden="true" />
                {m.editorRestore()}
              </Button>
              <Button
                variant={mode === "erase" ? "default" : "outline"}
                className={`h-20 flex-col gap-1.5 ${
                  mode === "erase"
                    ? "bg-rose-700 text-white hover:bg-rose-800"
                    : "border-rose-700 text-rose-800 dark:text-rose-300"
                }`}
                onClick={() => changeMode("erase")}
              >
                <CircleMinus className="size-6" aria-hidden="true" />
                {m.editorErase()}
              </Button>
            </div>
            <Typography
              variant="caption"
              as="p"
              className="min-h-10 leading-4 text-muted-foreground"
            >
              {m.editorManualHint()}
            </Typography>
            <div className="grid gap-3">
              <label className="grid max-w-md gap-2 text-sm font-medium">
                <span>{m.brushSize()}</span>
                <input
                  type="range"
                  min="8"
                  max="180"
                  defaultValue={initialView.brushSize}
                  onChange={(event) => changeBrushSize(Number(event.currentTarget.value))}
                />
              </label>
            </div>
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="w-full"
                  onClick={() => props.interaction.apply()}
                  disabled={!draftState.dirty}
                >
                  {m.cutoutApply()}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => props.interaction.cancel()}
                >
                  {m.cancel()}
                </Button>
              </div>
            </div>
            <Typography variant="caption" as="p" role="status" className="sr-only">
              {draftState.dirty ? m.editorManualDirty() : m.editorManualClean()}
            </Typography>
          </section>
        </ToolPanelSlot>
      </div>
    </>
  );
}
