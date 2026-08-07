import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CircleMinus, CirclePlus } from "lucide-react";

import type { MagicCutoutTypes } from "@/editor/domain";
import type { MagicRuntimeProgress } from "@/editor/runtime";
import { m } from "@/paraglide/messages";
import { Button, Typography } from "@/shared/ui";

import { ToolPanelSlot } from "../editor-tools";
import { CutoutModeTabs } from "../editor-tools/cutout-mode-tabs";
import type { MagicCutoutInteraction } from "./magic-cutout-workspace";

const RUNTIME_STATUS_LABELS: Partial<
  Record<NonNullable<MagicRuntimeProgress>["stage"], () => string>
> = {
  "magic-queued": m.editorMagicQueued,
  "magic-model-loading": m.editorMagicModelLoading,
  "magic-encode": m.editorMagicEncoding,
  "magic-predict": m.editorMagicPredicting,
};

const DRAFT_STATUS_LABELS: Partial<
  Record<MagicCutoutTypes.Draft["status"], () => string>
> = {
  encoding: m.editorMagicEncoding,
  predicting: m.editorMagicPredicting,
  preview: m.editorMagicPreviewReady,
  error: m.editorMagicError,
};

function statusLabel(
  draft: MagicCutoutTypes.Draft,
  runtimeProgress: MagicRuntimeProgress | null,
): string {
  const runtimeLabel =
    runtimeProgress === null ? undefined : RUNTIME_STATUS_LABELS[runtimeProgress.stage];
  if (runtimeLabel !== undefined) return runtimeLabel();
  const draftLabel = DRAFT_STATUS_LABELS[draft.status];
  if (draftLabel !== undefined) return draftLabel();
  return draft.dirty ? m.editorMagicDirty() : m.editorMagicReady();
}

function trapDialogTab(
  event: KeyboardEvent<HTMLDivElement>,
  dialog: HTMLDivElement | null,
): void {
  const focusable = dialog?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
  if (focusable === undefined || focusable.length === 0) return;
  const first = focusable.item(0);
  const last = focusable.item(focusable.length - 1);
  if (event.shiftKey) {
    if (event.target !== first) return;
    event.preventDefault();
    last.focus();
    return;
  }
  if (event.target !== last) return;
  event.preventDefault();
  first.focus();
}

export function MagicCutoutPanel(
  props: Readonly<{
    busy: boolean;
    draft: MagicCutoutTypes.Draft;
    initialRadius: number;
    interaction: MagicCutoutInteraction;
    mode: MagicCutoutTypes.Mode;
    onCutoutModeChange?(mode: "magic" | "manual"): void;
    onModeChange(mode: MagicCutoutTypes.Mode): void;
    onRadiusChange(radius: number): void;
    runtimeProgress: MagicRuntimeProgress | null;
  }>,
) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousConfirmDiscardRef = useRef(false);

  useEffect(
    function routeDiscardDialogFocusFx() {
      if (confirmDiscard) continueButtonRef.current?.focus();
      else if (previousConfirmDiscardRef.current) cancelButtonRef.current?.focus();
      previousConfirmDiscardRef.current = confirmDiscard;
    },
    [confirmDiscard],
  );

  function discardDialogKeyDownFx(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      setConfirmDiscard(false);
      return;
    }
    if (event.key !== "Tab") return;
    trapDialogTab(event, dialogRef.current);
  }

  return (
    <div className="[grid-area:rail]">
      <ToolPanelSlot toolId="cutout" label={m.editorMagicTitle()} autoFocus>
        <section className="flex h-full min-h-0 flex-col gap-5">
          <CutoutModeTabs
            mode="magic"
            onModeChange={(mode) => props.onCutoutModeChange?.(mode)}
          />
          <div
            className="grid grid-cols-2 gap-2"
            role="toolbar"
            aria-label={m.editorMagicMode()}
          >
            <Button
              variant={props.mode === "keep" ? "default" : "outline"}
              className={`h-20 flex-col gap-1.5 ${props.mode === "keep" ? "bg-emerald-700 text-white hover:bg-emerald-800" : "border-emerald-700 text-emerald-800 dark:text-emerald-300"}`}
              onClick={() => props.onModeChange("keep")}
              disabled={props.busy}
            >
              <CirclePlus className="size-6" aria-hidden="true" />
              {m.guidedBrushKeep()}
            </Button>
            <Button
              variant={props.mode === "remove" ? "default" : "outline"}
              className={`h-20 flex-col gap-1.5 ${props.mode === "remove" ? "bg-rose-700 text-white hover:bg-rose-800" : "border-rose-700 text-rose-800 dark:text-rose-300"}`}
              onClick={() => props.onModeChange("remove")}
              disabled={props.busy}
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
              defaultValue={props.initialRadius}
              disabled={props.busy}
              onChange={(event) =>
                props.onRadiusChange(Number(event.currentTarget.value))
              }
            />
          </label>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <Button
              className="w-full"
              onClick={props.interaction.apply}
              disabled={!props.draft.dirty || props.busy}
            >
              {props.busy ? m.editorMagicWorking() : m.cutoutApply()}
            </Button>
            <Button
              ref={cancelButtonRef}
              variant="outline"
              className="w-full"
              onClick={() => {
                if (props.draft.dirty) setConfirmDiscard(true);
                else props.interaction.cancel();
              }}
              disabled={props.busy}
            >
              {m.cancel()}
            </Button>
          </div>
          <Typography
            variant="caption"
            as="p"
            className="text-pretty text-muted-foreground"
          >
            {m.editorMagicFirstRunHint()}
          </Typography>
          {confirmDiscard ? (
            <div
              ref={dialogRef}
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
                  onClick={props.interaction.cancel}
                >
                  {m.editorDraftDiscard()}
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </ToolPanelSlot>
    </div>
  );
}
