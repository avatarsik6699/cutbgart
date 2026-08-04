import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CircleMinus, CirclePlus } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Button, EditorStage } from "@/shared/ui";
import type { ManualCutoutMode } from "@/v2/domain";
import { Typography } from "@/v2/shared/ui";
import {
  CanvasViewControls,
  ToolPanelSlot,
  type CanvasInteractionMode,
} from "@/widgets/tool-workspace";
import { CutoutModeTabs } from "../editor-tools/cutout-mode-tabs";

type Props = {
  documentId: string;
  height: number;
  interaction: ManualCutoutInteraction;
  sourceUrl: string;
  width: number;
  onCutoutModeChange?(mode: "magic" | "manual"): void;
};

export type ManualCutoutInteraction = Readonly<{
  apply(): void;
  begin(
    point: Readonly<{ x: number; y: number }>,
    brush: Readonly<{ mode: ManualCutoutMode; radius: number; hardness: number }>,
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
    brush: Readonly<{ mode: ManualCutoutMode; radius: number; hardness: number }>,
  ): void;
  readViewState(): Readonly<{
    mode: ManualCutoutMode;
    brushSize: number;
    zoom: number;
  }>;
  writeViewState(
    state: Readonly<{
      mode: ManualCutoutMode;
      brushSize: number;
      zoom: number;
    }>,
  ): void;
  redo(): void;
  snapshot(): Readonly<{ canRedo: boolean; canUndo: boolean; dirty: boolean }> | null;
  undo(): void;
}>;

type Cursor = { x: number; y: number } | null;

export function ManualCutoutWorkspace(props: Props) {
  const initialView = props.interaction.readViewState();
  const [mode, setMode] = useState<ManualCutoutMode>(initialView.mode);
  const [brushSize, setBrushSize] = useState(initialView.brushSize);
  const [zoom, setZoom] = useState(initialView.zoom);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>("brush");
  const [viewControlsCollapsed, setViewControlsCollapsed] = useState(false);
  const [cursor, setCursor] = useState<Cursor>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panPointerRef = useRef<Readonly<{
    pointerId: number;
    clientX: number;
    clientY: number;
  }> | null>(null);
  const draftState = props.interaction.snapshot();

  function changeMode(nextMode: ManualCutoutMode): void {
    setMode(nextMode);
    props.interaction.writeViewState({ mode: nextMode, brushSize, zoom });
  }

  function changeBrushSize(nextBrushSize: number): void {
    setBrushSize(nextBrushSize);
    props.interaction.writeViewState({ mode, brushSize: nextBrushSize, zoom });
  }

  function changeZoom(update: (value: number) => number): void {
    setZoom((current) => {
      const nextZoom = update(current);
      props.interaction.writeViewState({ mode, brushSize, zoom: nextZoom });
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

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (draftState === null || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (interactionMode === "hand") {
      panPointerRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      return;
    }
    const point = sourcePoint(event);
    props.interaction.begin(point, { mode, radius: brushSize / 2, hardness: 0.72 });
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const panPointer = panPointerRef.current;
    if (panPointer?.pointerId === event.pointerId) {
      const viewport = viewportRef.current;
      if (viewport !== null) {
        viewport.scrollLeft -= event.clientX - panPointer.clientX;
        viewport.scrollTop -= event.clientY - panPointer.clientY;
      }
      panPointerRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      return;
    }
    const point = sourcePoint(event);
    setCursor(point);
    if (draftState === null || !event.currentTarget.hasPointerCapture(event.pointerId))
      return;
    props.interaction.move(point, { mode, radius: brushSize / 2, hardness: 0.72 });
  }

  function pointerUp(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (panPointerRef.current?.pointerId === event.pointerId) {
      panPointerRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (draftState === null || !event.currentTarget.hasPointerCapture(event.pointerId))
      return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    props.interaction.end();
  }

  function pointerCancel(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (panPointerRef.current?.pointerId === event.pointerId) {
      panPointerRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
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
        props.sourceUrl,
        props.width,
        props.height,
      );
    },
    [draftState, props.height, props.interaction, props.sourceUrl, props.width],
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

  if (draftState === null) return null;

  return (
    <>
      <div className="[grid-area:surface]">
        <EditorStage
          documentId={props.documentId}
          overlaySlot={({ expanded, toggleFullscreen }) => (
            <CanvasViewControls
              interactionMode={interactionMode}
              onInteractionModeChange={setInteractionMode}
              zoomPercent={Math.round(zoom * 100)}
              canZoomIn={zoom < 3}
              canZoomOut={zoom > 0.5}
              canPan={zoom > 1}
              onZoomIn={() => changeZoom((value) => Math.min(3, value + 0.25))}
              onZoomOut={() => changeZoom((value) => Math.max(0.5, value - 0.25))}
              onResetView={() => changeZoom(() => 1)}
              expanded={expanded}
              onToggleFullscreen={toggleFullscreen}
              collapsed={viewControlsCollapsed}
              onCollapsedChange={setViewControlsCollapsed}
            />
          )}
        >
          <div
            ref={viewportRef}
            className="border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,var(--card)_0_50%)] bg-[length:18px_18px] focus-visible:ring-ring relative max-h-full w-full overflow-auto rounded-lg border p-3 focus-visible:ring-2"
            tabIndex={0}
            aria-label={m.editorV2ManualViewport()}
          >
            <div
              className="relative mx-auto origin-top-left"
              style={{ width: `${zoom * 100}%` }}
            >
              <canvas
                role="img"
                ref={canvasRef}
                width={props.width}
                height={props.height}
                className="block h-auto w-full touch-none select-none"
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={pointerCancel}
                onPointerLeave={() => setCursor(null)}
                aria-label={m.editorV2ManualCanvas()}
              />
              {cursor !== null ? (
                <span
                  className="border-foreground pointer-events-none absolute rounded-full border"
                  style={{
                    width: `${(brushSize / props.width) * 100}%`,
                    aspectRatio: "1",
                    left: `${(cursor.x / props.width) * 100}%`,
                    top: `${(cursor.y / props.height) * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              ) : null}
            </div>
          </div>
        </EditorStage>
      </div>
      <div className="[grid-area:rail]">
        <ToolPanelSlot toolId="cutout" label={m.editorV2ManualWorkspace()} autoFocus>
          <section className="flex h-full min-h-0 flex-col gap-5">
            <CutoutModeTabs
              mode="manual"
              onModeChange={(mode) => props.onCutoutModeChange?.(mode)}
            />
            <div
              className="grid grid-cols-2 gap-2"
              role="toolbar"
              aria-label={m.editorV2ManualMode()}
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
                {m.editorV2Restore()}
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
                {m.editorV2Erase()}
              </Button>
            </div>
            <Typography
              variant="caption"
              as="p"
              className="min-h-10 leading-4 text-muted-foreground"
            >
              {m.editorV2ManualHint()}
            </Typography>
            <div className="grid gap-3">
              <label className="grid max-w-md gap-2 text-sm font-medium">
                <span>{m.brushSize()}</span>
                <input
                  type="range"
                  min="8"
                  max="180"
                  value={brushSize}
                  onChange={(event) => changeBrushSize(Number(event.currentTarget.value))}
                />
              </label>
            </div>
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={undo} disabled={!draftState.canUndo}>
                  {m.editorV2DraftUndo()}
                </Button>
                <Button variant="outline" onClick={redo} disabled={!draftState.canRedo}>
                  {m.editorV2DraftRedo()}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
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
              {draftState.dirty ? m.editorV2ManualDirty() : m.editorV2ManualClean()}
            </Typography>
          </section>
        </ToolPanelSlot>
      </div>
    </>
  );
}
