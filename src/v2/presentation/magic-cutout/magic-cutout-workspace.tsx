import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CircleMinus, CirclePlus } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Button, EditorStage } from "@/shared/ui";
import type { MagicCutoutDraft, MagicCutoutMode } from "@/v2/domain";
import type { MagicRuntimeProgress } from "@/v2/runtime-browser";
import { Image, Typography } from "@/v2/shared/ui";
import { CanvasViewControls, ToolPanelSlot, type CanvasInteractionMode } from "../shared";
import {
  CUTOUT_STAGE_VIEWPORT_CLASS_NAME,
  CutoutStagePanController,
  cutoutStageContentStyle,
  isEditableCanvasShortcutTarget,
} from "../cutout-stage";
import { CutoutModeTabs } from "../editor-tools/cutout-mode-tabs";

type Props = {
  draft: MagicCutoutDraft;
  height: number;
  runtimeProgress: MagicRuntimeProgress | null;
  interaction: MagicCutoutInteraction;
  currentUrl: string;
  width: number;
  onCutoutModeChange?(mode: "magic" | "manual"): void;
};

export type MagicCutoutInteraction = Readonly<{
  apply(): void;
  appendPoint(point: Readonly<{ x: number; y: number }>): void;
  beginStroke(
    input: Readonly<{
      id: string;
      mode: MagicCutoutMode;
      point: Readonly<{ x: number; y: number }>;
      radius: number;
    }>,
  ): boolean;
  cancel(): void;
  cancelStroke(): void;
  commitStroke(): boolean;
  displayStrokes(): readonly Readonly<{
    id: string;
    mode: MagicCutoutMode;
    points: readonly Readonly<{ x: number; y: number }>[];
    radius: number;
  }>[];
  readViewState(): Readonly<{ mode: MagicCutoutMode; radius: number }>;
  redo(): void;
  snapshot(): Readonly<{
    canRedo: boolean;
    canUndo: boolean;
    strokeCount: number;
  }> | null;
  undo(): void;
  writeViewState(state: Readonly<{ mode: MagicCutoutMode; radius: number }>): void;
}>;

function statusLabel(
  draft: MagicCutoutDraft,
  runtimeProgress: MagicRuntimeProgress | null,
): string {
  if (runtimeProgress?.stage === "magic-queued") return m.editorV2MagicQueued();
  if (runtimeProgress?.stage === "magic-model-loading")
    return m.editorV2MagicModelLoading();
  if (runtimeProgress?.stage === "magic-encode") return m.editorV2MagicEncoding();
  if (runtimeProgress?.stage === "magic-predict") return m.editorV2MagicPredicting();
  if (draft.status === "encoding") return m.editorV2MagicEncoding();
  if (draft.status === "predicting") return m.editorV2MagicPredicting();
  if (draft.status === "preview") return m.editorV2MagicPreviewReady();
  if (draft.status === "error") return m.editorV2MagicError();
  return draft.dirty ? m.editorV2MagicDirty() : m.editorV2MagicReady();
}

export function MagicCutoutWorkspace(props: Props) {
  const initialView = props.interaction.readViewState();
  const [mode, setMode] = useState<MagicCutoutMode>(initialView.mode);
  const radiusRef = useRef(initialView.radius);
  const [zoom, setZoom] = useState(1);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>("brush");
  const [spacePanning, setSpacePanning] = useState(false);
  const [panning, setPanning] = useState(false);
  const [panController] = useState(() => new CutoutStagePanController(1));
  const spacePanningRef = useRef(false);
  const [viewControlsCollapsed, setViewControlsCollapsed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const discardDialogRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousConfirmDiscardRef = useRef(false);

  function changeMode(nextMode: MagicCutoutMode): void {
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

  function changeZoom(update: (zoom: number) => number): void {
    setZoom((currentZoom) => {
      const nextZoom = update(currentZoom);
      panController.setZoom(nextZoom);
      return nextZoom;
    });
  }

  function beginPan(event: ReactPointerEvent<HTMLCanvasElement>): boolean {
    const handGesture =
      interactionMode === "hand" || spacePanningRef.current || event.button === 1;
    if (!handGesture || (event.button !== 0 && event.button !== 1)) return false;
    event.preventDefault();
    panController.start(event);
    setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    return true;
  }

  function movePan(event: ReactPointerEvent<HTMLCanvasElement>): boolean {
    return panController.move(event);
  }

  function endPan(event: ReactPointerEvent<HTMLCanvasElement>): boolean {
    if (!panController.stop(event.pointerId)) return false;
    setPanning(false);
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
    for (const stroke of props.interaction.displayStrokes()) {
      const first = stroke.points[0];
      if (first === undefined) continue;
      context.beginPath();
      context.moveTo(first.x * scaleX, first.y * scaleY);
      for (const point of stroke.points.slice(1))
        context.lineTo(point.x * scaleX, point.y * scaleY);
      context.strokeStyle = stroke.mode === "keep" ? "#22c55e" : "#ef4444";
      context.globalAlpha = 0.78;
      context.lineWidth = stroke.radius * 2 * scaleX;
      context.stroke();
      if (stroke.points.length === 1) {
        context.beginPath();
        context.arc(
          first.x * scaleX,
          first.y * scaleY,
          stroke.radius * scaleX,
          0,
          Math.PI * 2,
        );
        context.fillStyle = context.strokeStyle;
        context.fill();
      }
    }
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
    function routeMagicSpacePanFx() {
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
      return function removeMagicSpacePanFx() {
        globalThis.removeEventListener("keydown", keyDownFx);
        globalThis.removeEventListener("keyup", keyUpFx);
        globalThis.removeEventListener("blur", blurFx);
      };
    },
    [panController],
  );

  useEffect(
    function routeDiscardDialogFocusFx() {
      if (confirmDiscard) continueButtonRef.current?.focus();
      else if (previousConfirmDiscardRef.current) cancelButtonRef.current?.focus();
      previousConfirmDiscardRef.current = confirmDiscard;
    },
    [confirmDiscard],
  );

  useEffect(
    function guardDirtyMagicDraftFx() {
      function beforeUnloadFx(event: BeforeUnloadEvent): void {
        if (!props.draft.dirty) return;
        event.preventDefault();
        event.returnValue = "";
      }
      function keyDownFx(event: KeyboardEvent): void {
        if (!(event.ctrlKey || event.metaKey)) return;
        const key = event.key.toLowerCase();
        if (key !== "z" && key !== "y") return;
        event.preventDefault();
        if (key === "y" || event.shiftKey) props.interaction.redo();
        else props.interaction.undo();
      }
      globalThis.addEventListener("beforeunload", beforeUnloadFx);
      globalThis.addEventListener("keydown", keyDownFx);
      return function removeMagicDraftGuardsFx() {
        globalThis.removeEventListener("beforeunload", beforeUnloadFx);
        globalThis.removeEventListener("keydown", keyDownFx);
      };
    },
    [props.draft.dirty, props.interaction],
  );

  function pointerDownFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (
      activePointer.current !== null ||
      props.draft.status === "encoding" ||
      props.draft.status === "predicting"
    )
      return;
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
    if (interactionMode === "brush" && !spacePanning) positionCursor(point);
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

  const busy = props.draft.status === "encoding" || props.draft.status === "predicting";
  let canvasCursorClassName = "cursor-none";
  if (interactionMode === "hand" || spacePanning)
    canvasCursorClassName = panning ? "cursor-grabbing" : "cursor-grab";

  function discardDialogKeyDownFx(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      setConfirmDiscard(false);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = discardDialogRef.current?.querySelectorAll<HTMLButtonElement>(
      "button:not([disabled])",
    );
    const first = focusable?.[0];
    const last = focusable?.[(focusable.length ?? 0) - 1];
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && event.target === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <div className="[grid-area:surface]">
        <EditorStage
          documentId={props.draft.documentId}
          overlaySlot={({ expanded, toggleFullscreen }) => (
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
            />
          )}
        >
          <div
            className={CUTOUT_STAGE_VIEWPORT_CLASS_NAME}
            tabIndex={0}
            aria-label={m.editorV2MagicTitle()}
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
              <Image
                src={props.currentUrl}
                alt={m.editorV2ResultAlt()}
                preset="preview"
                width={props.width}
                height={props.height}
                className="absolute inset-0 size-full object-contain"
              />
              <canvas
                ref={strokeCanvas}
                className={`absolute inset-0 block h-full w-full touch-none ${canvasCursorClassName}`}
                aria-label={m.editorV2MagicCanvas()}
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
                data-testid="magic-brush-cursor"
                hidden
                aria-hidden="true"
                className={`pointer-events-none absolute rounded-full border-2 ${
                  mode === "keep" ? "border-emerald-700" : "border-rose-700"
                }`}
                style={{
                  width: `${(initialView.radius * 2 * 100) / props.width}%`,
                  height: `${(initialView.radius * 2 * 100) / props.height}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>
          </div>
        </EditorStage>
      </div>
      <div className="[grid-area:rail]">
        <ToolPanelSlot toolId="cutout" label={m.editorV2MagicTitle()} autoFocus>
          <section className="flex h-full min-h-0 flex-col gap-5">
            <CutoutModeTabs
              mode="magic"
              onModeChange={(mode) => props.onCutoutModeChange?.(mode)}
            />
            <div
              className="grid grid-cols-2 gap-2"
              role="toolbar"
              aria-label={m.editorV2MagicMode()}
            >
              <Button
                variant={mode === "keep" ? "default" : "outline"}
                className={`h-20 flex-col gap-1.5 ${
                  mode === "keep"
                    ? "bg-emerald-700 text-white hover:bg-emerald-800"
                    : "border-emerald-700 text-emerald-800 dark:text-emerald-300"
                }`}
                onClick={() => changeMode("keep")}
              >
                <CirclePlus className="size-6" aria-hidden="true" />
                {m.guidedBrushKeep()}
              </Button>
              <Button
                variant={mode === "remove" ? "default" : "outline"}
                className={`h-20 flex-col gap-1.5 ${
                  mode === "remove"
                    ? "bg-rose-700 text-white hover:bg-rose-800"
                    : "border-rose-700 text-rose-800 dark:text-rose-300"
                }`}
                onClick={() => changeMode("remove")}
              >
                <CircleMinus className="size-6" aria-hidden="true" />
                {m.guidedBrushRemove()}
              </Button>
            </div>

            <Typography variant="caption" as="p" className="sr-only" aria-live="polite">
              {statusLabel(props.draft, props.runtimeProgress)}
            </Typography>

            <label className="grid max-w-md gap-2 text-sm font-medium">
              <span>{m.brushSize()}</span>
              <input
                type="range"
                min="2"
                max="80"
                defaultValue={initialView.radius}
                onChange={(event) => changeRadius(Number(event.currentTarget.value))}
              />
            </label>

            <div className="mt-auto flex flex-col gap-2 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="w-full"
                  onClick={() => props.interaction.apply()}
                  disabled={!props.draft.dirty || busy}
                >
                  {busy ? m.editorV2MagicWorking() : m.cutoutApply()}
                </Button>
                <Button
                  ref={cancelButtonRef}
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (props.draft.dirty) setConfirmDiscard(true);
                    else props.interaction.cancel();
                  }}
                >
                  {m.cancel()}
                </Button>
              </div>
            </div>
            {confirmDiscard ? (
              <div
                ref={discardDialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="magic-discard-title"
                aria-describedby="magic-discard-body"
                className="border-destructive/40 bg-destructive/5 rounded-lg border p-4"
                onKeyDown={discardDialogKeyDownFx}
              >
                <Typography id="magic-discard-title" variant="heading-3" as="h3">
                  {m.editorDraftGuardTitle()}
                </Typography>
                <Typography
                  id="magic-discard-body"
                  variant="body-small"
                  as="p"
                  className="mt-2"
                >
                  {m.editorDraftGuardBody()}
                </Typography>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    ref={continueButtonRef}
                    variant="outline"
                    onClick={() => setConfirmDiscard(false)}
                  >
                    {m.editorDraftContinue()}
                  </Button>
                  <Button
                    variant="destructive"
                    style={{
                      backgroundColor: "var(--destructive)",
                      color: "var(--destructive-foreground)",
                    }}
                    onClick={() => props.interaction.cancel()}
                  >
                    {m.editorDraftDiscard()}
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </ToolPanelSlot>
      </div>
    </>
  );
}
