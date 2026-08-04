import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CircleMinus, CirclePlus } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Button, EditorStage } from "@/shared/ui";
import type {
  MagicCandidateSummary,
  MagicCandidateId,
  MagicCutoutDraft,
  MagicCutoutMode,
} from "@/v2/domain";
import type { MagicRuntimeProgress } from "@/v2/runtime-browser";
import { Image, Typography } from "@/v2/shared/ui";
import {
  CanvasViewControls,
  ToolPanelSlot,
  type CanvasInteractionMode,
} from "@/widgets/tool-workspace";
import { CutoutModeTabs } from "../editor-tools/cutout-mode-tabs";

type Props = {
  candidates: readonly MagicCandidateSummary[];
  draft: MagicCutoutDraft;
  height: number;
  runtimeProgress: MagicRuntimeProgress | null;
  interaction: MagicCutoutInteraction;
  sourceUrl: string;
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
  paintCandidate(canvas: HTMLCanvasElement, candidateId: MagicCandidateId | null): void;
  predict(): void;
  readViewState(): Readonly<{ mode: MagicCutoutMode; radius: number }>;
  redo(): void;
  selectCandidate(candidateId: MagicCandidateId): void;
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
  const [radius, setRadius] = useState(initialView.radius);
  const [zoom, setZoom] = useState(1);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>("brush");
  const [viewControlsCollapsed, setViewControlsCollapsed] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [, setPaintRevision] = useState(0);
  const discardDialogRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousConfirmDiscardRef = useRef(false);

  function changeMode(nextMode: MagicCutoutMode): void {
    setMode(nextMode);
    props.interaction.writeViewState({ mode: nextMode, radius });
  }

  function changeRadius(nextRadius: number): void {
    setRadius(nextRadius);
    props.interaction.writeViewState({ mode, radius: nextRadius });
  }
  const candidateCanvas = useRef<HTMLCanvasElement>(null);
  const strokeCanvas = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const panPointer = useRef<Readonly<{
    pointerId: number;
    clientX: number;
    clientY: number;
  }> | null>(null);
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const strokeSequence = useRef(0);

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
    canvas.width = props.width;
    canvas.height = props.height;
    const context = canvas.getContext("2d");
    if (context === null) return;
    context.clearRect(0, 0, props.width, props.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of props.interaction.displayStrokes()) {
      const first = stroke.points[0];
      if (first === undefined) continue;
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
      context.strokeStyle = stroke.mode === "keep" ? "#22c55e" : "#ef4444";
      context.globalAlpha = 0.78;
      context.lineWidth = stroke.radius * 2;
      context.stroke();
      if (stroke.points.length === 1) {
        context.beginPath();
        context.arc(first.x, first.y, stroke.radius, 0, Math.PI * 2);
        context.fillStyle = context.strokeStyle;
        context.fill();
      }
    }
    context.globalAlpha = 1;
    if (cursor.current !== null) {
      context.beginPath();
      context.arc(cursor.current.x, cursor.current.y, radius, 0, Math.PI * 2);
      context.strokeStyle = mode === "keep" ? "#16a34a" : "#dc2626";
      context.lineWidth = Math.max(1, props.width / 700);
      context.stroke();
    }
  }

  useEffect(paintStrokesFx, [
    mode,
    props.draft.draftRevision,
    props.height,
    props.interaction,
    props.width,
    radius,
  ]);

  useEffect(
    function routeDiscardDialogFocusFx() {
      if (confirmDiscard) continueButtonRef.current?.focus();
      else if (previousConfirmDiscardRef.current) cancelButtonRef.current?.focus();
      previousConfirmDiscardRef.current = confirmDiscard;
    },
    [confirmDiscard],
  );

  useEffect(
    function paintCandidateFx() {
      if (candidateCanvas.current !== null) {
        props.interaction.paintCandidate(
          candidateCanvas.current,
          props.draft.selectedCandidateId,
        );
      }
    },
    [props.draft.selectedCandidateId, props.interaction],
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
        setPaintRevision((value) => value + 1);
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
    if (interactionMode === "hand") {
      panPointer.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const point = sourcePoint(event);
    const started = props.interaction.beginStroke({
      id: `magic-stroke-${++strokeSequence.current}`,
      mode,
      point,
      radius,
    });
    if (!started) return;
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    cursor.current = point;
    paintStrokesFx();
  }

  function pointerMoveFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const activePan = panPointer.current;
    if (activePan?.pointerId === event.pointerId) {
      const viewport = viewportRef.current;
      if (viewport !== null) {
        viewport.scrollLeft -= event.clientX - activePan.clientX;
        viewport.scrollTop -= event.clientY - activePan.clientY;
      }
      panPointer.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      return;
    }
    const point = sourcePoint(event);
    cursor.current = point;
    if (activePointer.current === event.pointerId) {
      props.interaction.appendPoint(point);
    }
    paintStrokesFx();
  }

  function pointerUpFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (panPointer.current?.pointerId === event.pointerId) {
      panPointer.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (activePointer.current !== event.pointerId) return;
    props.interaction.appendPoint(sourcePoint(event));
    props.interaction.commitStroke();
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPaintRevision((value) => value + 1);
  }

  function pointerCancelFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (panPointer.current?.pointerId === event.pointerId) {
      panPointer.current = null;
      return;
    }
    if (activePointer.current !== event.pointerId) return;
    props.interaction.cancelStroke();
    activePointer.current = null;
    setPaintRevision((value) => value + 1);
  }

  function lostPointerCaptureFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (panPointer.current?.pointerId === event.pointerId) {
      panPointer.current = null;
      return;
    }
    if (activePointer.current !== event.pointerId) return;
    props.interaction.cancelStroke();
    activePointer.current = null;
    setPaintRevision((value) => value + 1);
  }

  const busy = props.draft.status === "encoding" || props.draft.status === "predicting";

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
              canPan={zoom > 1}
              onZoomIn={() => setZoom((value) => Math.min(3, value + 0.25))}
              onZoomOut={() => setZoom((value) => Math.max(0.5, value - 0.25))}
              onResetView={() => setZoom(1)}
              expanded={expanded}
              onToggleFullscreen={toggleFullscreen}
              collapsed={viewControlsCollapsed}
              onCollapsedChange={setViewControlsCollapsed}
            />
          )}
        >
          <div ref={viewportRef} className="bg-muted size-full overflow-auto rounded-lg">
            <div
              className="relative mx-auto origin-top-left"
              style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
            >
              <Image
                src={props.sourceUrl}
                alt={m.editorV2SourceAlt()}
                preset="preview"
                width={props.width}
                height={props.height}
                className="absolute inset-0 size-full object-contain"
              />
              <canvas
                ref={candidateCanvas}
                className="pointer-events-none absolute inset-0 size-full"
                aria-hidden="true"
              />
              <canvas
                ref={strokeCanvas}
                className="absolute inset-0 size-full touch-none"
                aria-label={m.editorV2MagicCanvas()}
                onPointerDown={pointerDownFx}
                onPointerMove={pointerMoveFx}
                onPointerUp={pointerUpFx}
                onPointerCancel={pointerCancelFx}
                onLostPointerCapture={lostPointerCaptureFx}
                onPointerLeave={() => {
                  cursor.current = null;
                  paintStrokesFx();
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

            <Typography
              variant="caption"
              as="p"
              className="min-h-10 leading-4 text-muted-foreground"
              aria-live="polite"
            >
              {statusLabel(props.draft, props.runtimeProgress)} ·{" "}
              {m.editorV2MagicStrokeCount({
                count: String(props.interaction.snapshot()?.strokeCount ?? 0),
              })}
            </Typography>

            <label className="grid max-w-md gap-2 text-sm font-medium">
              <span>{m.brushSize()}</span>
              <input
                type="range"
                min="2"
                max="80"
                value={radius}
                onChange={(event) => changeRadius(Number(event.currentTarget.value))}
              />
            </label>

            {props.candidates.length > 0 ? (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={m.editorV2MagicCandidates()}
              >
                {props.candidates.map((candidate, index) => (
                  <Button
                    key={candidate.candidateId}
                    variant={
                      props.draft.selectedCandidateId === candidate.candidateId
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      props.interaction.selectCandidate(candidate.candidateId)
                    }
                  >
                    {m.editorV2MagicCandidate({ number: String(index + 1) })}
                  </Button>
                ))}
              </div>
            ) : null}

            <div className="mt-auto flex flex-col gap-2 pt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => props.interaction.predict()}
                  disabled={!props.draft.dirty || busy}
                >
                  {busy ? m.editorV2MagicWorking() : m.editorV2MagicPredict()}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    props.interaction.undo();
                    setPaintRevision((value) => value + 1);
                  }}
                  disabled={props.interaction.snapshot()?.canUndo !== true}
                >
                  {m.editorV2MagicUndo()}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    props.interaction.redo();
                    setPaintRevision((value) => value + 1);
                  }}
                  disabled={props.interaction.snapshot()?.canRedo !== true}
                >
                  {m.editorV2MagicRedo()}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  className="w-full"
                  onClick={() => props.interaction.apply()}
                  disabled={props.draft.selectedCandidateId === null || busy}
                >
                  {m.cutoutApply()}
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
