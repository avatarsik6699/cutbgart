import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import type {
  MagicCandidateSummary,
  MagicCutoutDraft,
  MagicCutoutMode,
} from "@/v2/domain";
import type { EditorSession, MagicRuntimeProgress } from "@/v2/runtime-browser";
import { Image, Typography } from "@/v2/shared/ui";

type Props = {
  candidates: readonly MagicCandidateSummary[];
  draft: MagicCutoutDraft;
  height: number;
  runtimeProgress: MagicRuntimeProgress | null;
  session: EditorSession;
  sourceUrl: string;
  width: number;
};

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
  const initialView = props.session.magicViewState();
  const [mode, setMode] = useState<MagicCutoutMode>(initialView.mode);
  const [radius, setRadius] = useState(initialView.radius);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [, setPaintRevision] = useState(0);
  const workspaceRef = useRef<HTMLElement>(null);
  const discardDialogRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousConfirmDiscardRef = useRef(false);

  function changeMode(nextMode: MagicCutoutMode): void {
    setMode(nextMode);
    props.session.setMagicViewState({ mode: nextMode, radius });
  }

  function changeRadius(nextRadius: number): void {
    setRadius(nextRadius);
    props.session.setMagicViewState({ mode, radius: nextRadius });
  }
  const candidateCanvas = useRef<HTMLCanvasElement>(null);
  const strokeCanvas = useRef<HTMLCanvasElement>(null);
  const activePointer = useRef<number | null>(null);
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
    const engine = props.session.magicDraft();
    if (canvas === null || engine === null) return;
    canvas.width = props.width;
    canvas.height = props.height;
    const context = canvas.getContext("2d");
    if (context === null) return;
    context.clearRect(0, 0, props.width, props.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of engine.displayStrokes()) {
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
    props.session,
    props.width,
    radius,
  ]);

  useEffect(function focusMagicWorkspaceFx() {
    workspaceRef.current?.focus();
  }, []);

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
        props.session.paintMagicCandidate(
          candidateCanvas.current,
          props.draft.selectedCandidateId,
        );
      }
    },
    [props.draft.selectedCandidateId, props.session],
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
        if (key === "y" || event.shiftKey) props.session.redoMagic();
        else props.session.undoMagic();
        setPaintRevision((value) => value + 1);
      }
      globalThis.addEventListener("beforeunload", beforeUnloadFx);
      globalThis.addEventListener("keydown", keyDownFx);
      return function removeMagicDraftGuardsFx() {
        globalThis.removeEventListener("beforeunload", beforeUnloadFx);
        globalThis.removeEventListener("keydown", keyDownFx);
      };
    },
    [props.draft.dirty, props.session],
  );

  function pointerDownFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (
      activePointer.current !== null ||
      props.draft.status === "encoding" ||
      props.draft.status === "predicting"
    )
      return;
    const engine = props.session.magicDraft();
    if (engine === null) return;
    const point = sourcePoint(event);
    const started = engine.beginStroke({
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
    const point = sourcePoint(event);
    cursor.current = point;
    if (activePointer.current === event.pointerId) {
      props.session.magicDraft()?.appendPoint(point);
    }
    paintStrokesFx();
  }

  function pointerUpFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (activePointer.current !== event.pointerId) return;
    props.session.magicDraft()?.appendPoint(sourcePoint(event));
    const committed = props.session.magicDraft()?.commitStroke() ?? null;
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (committed !== null) props.session.notifyMagicChanged();
    setPaintRevision((value) => value + 1);
  }

  function pointerCancelFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (activePointer.current !== event.pointerId) return;
    props.session.magicDraft()?.cancelStroke();
    activePointer.current = null;
    setPaintRevision((value) => value + 1);
  }

  function lostPointerCaptureFx(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (activePointer.current !== event.pointerId) return;
    props.session.magicDraft()?.cancelStroke();
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
    <section
      ref={workspaceRef}
      tabIndex={-1}
      className="border-border bg-card/60 grid gap-4 rounded-xl border p-4 sm:p-5"
      aria-label={m.editorV2MagicTitle()}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography variant="heading-2" as="h2">
            {m.editorV2MagicTitle()}
          </Typography>
          <Typography
            variant="caption"
            as="p"
            className="text-muted-foreground mt-1"
            aria-live="polite"
          >
            {statusLabel(props.draft, props.runtimeProgress)} ·{" "}
            {m.editorV2MagicStrokeCount({
              count: String(props.session.magicDraft()?.snapshot().strokeCount ?? 0),
            })}
          </Typography>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={m.editorV2MagicMode()}
        >
          <Button
            variant={mode === "keep" ? "default" : "outline"}
            onClick={() => changeMode("keep")}
          >
            {m.editorV2MagicKeep()}
          </Button>
          <Button
            variant={mode === "remove" ? "default" : "outline"}
            onClick={() => changeMode("remove")}
          >
            {m.editorV2MagicRemove()}
          </Button>
        </div>
      </div>

      <label className="grid gap-2">
        <Typography variant="label" as="span">
          {m.editorV2MagicBrushSize({ size: String(radius) })}
        </Typography>
        <input
          type="range"
          min="2"
          max="80"
          value={radius}
          onChange={(event) => changeRadius(Number(event.currentTarget.value))}
        />
      </label>

      <div
        className="bg-muted relative mx-auto w-full max-w-5xl overflow-hidden rounded-lg"
        style={{ aspectRatio: `${props.width} / ${props.height}` }}
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
              onClick={() => props.session.selectMagicCandidate(candidate.candidateId)}
            >
              {m.editorV2MagicCandidate({ number: String(index + 1) })}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => props.session.predictMagic()}
          disabled={!props.draft.dirty || busy}
        >
          {busy ? m.editorV2MagicWorking() : m.editorV2MagicPredict()}
        </Button>
        <Button
          onClick={() => props.session.applyMagic()}
          disabled={props.draft.selectedCandidateId === null || busy}
        >
          {m.editorV2MagicApply()}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            props.session.undoMagic();
            setPaintRevision((value) => value + 1);
          }}
          disabled={!props.session.magicDraft()?.snapshot().canUndo}
        >
          {m.editorV2MagicUndo()}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            props.session.redoMagic();
            setPaintRevision((value) => value + 1);
          }}
          disabled={!props.session.magicDraft()?.snapshot().canRedo}
        >
          {m.editorV2MagicRedo()}
        </Button>
        <Button
          ref={cancelButtonRef}
          variant="ghost"
          onClick={() => {
            if (props.draft.dirty) setConfirmDiscard(true);
            else props.session.cancelMagic();
          }}
        >
          {m.editorV2Cancel()}
        </Button>
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
              onClick={() => props.session.cancelMagic()}
            >
              {m.editorDraftDiscard()}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
