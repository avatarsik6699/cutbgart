import { useEffect, useRef } from "react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import type { EnhancementDraft, EnhancementOperationId } from "@/v2/domain";
import type { EditorSession, EnhancementRuntimeSnapshot } from "@/v2/runtime-browser";
import { Image, Typography } from "@/v2/shared/ui";

type Props = {
  draft: EnhancementDraft;
  height: number;
  previewUrl: string;
  runtime: EnhancementRuntimeSnapshot;
  session: EditorSession;
  width: number;
};

function operationLabel(operationId: EnhancementOperationId): string {
  return operationId === "fine-detail"
    ? m.editorV2EnhancementsFineDetail()
    : m.editorV2EnhancementsColourHalo();
}

function runtimeStatus(props: Props): string {
  if (props.runtime.status === "queued") return m.editorV2EnhancementsQueued();
  if (props.runtime.status === "running") {
    const operation =
      props.runtime.activeOperationId === null
        ? m.editorV2EnhancementsRunning()
        : operationLabel(props.runtime.activeOperationId);
    return props.runtime.fraction === null
      ? m.editorV2EnhancementsRunningStage({ stage: operation })
      : m.editorV2EnhancementsRunningProgress({
          stage: operation,
          progress: String(Math.round(props.runtime.fraction * 100)),
        });
  }
  if (props.runtime.status === "applying") return m.editorV2EnhancementsApplying();
  if (props.runtime.status === "no-change") return m.editorV2EnhancementsNoChange();
  if (props.runtime.status === "error") return m.editorV2EnhancementsError();
  return props.draft.selectedOperationIds.length === 0
    ? m.editorV2EnhancementsEmpty()
    : m.editorV2EnhancementsReady();
}

export function EnhancementWorkspace(props: Props) {
  const workspaceRef = useRef<HTMLElement>(null);
  const busy = ["queued", "running", "applying"].includes(props.runtime.status);

  function toggleOperation(operationId: EnhancementOperationId): void {
    const selected = new Set(props.draft.selectedOperationIds);
    if (selected.has(operationId)) selected.delete(operationId);
    else selected.add(operationId);
    props.session.changeEnhancements([...selected]);
  }

  useEffect(function focusEnhancementWorkspaceFx() {
    workspaceRef.current?.focus();
  }, []);

  return (
    <section
      ref={workspaceRef}
      tabIndex={-1}
      className="border-border bg-card/60 grid gap-4 rounded-xl border p-4 sm:p-5"
      aria-label={m.editorV2EnhancementsTitle()}
    >
      <div>
        <Typography variant="heading-2" as="h2">
          {m.editorV2EnhancementsTitle()}
        </Typography>
        <Typography variant="caption" as="p" className="text-muted-foreground mt-1">
          {m.editorV2EnhancementsHint()}
        </Typography>
      </div>

      <div
        className="border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,var(--card)_0_50%)] bg-[length:18px_18px] relative mx-auto w-full max-w-5xl overflow-hidden rounded-lg border"
        style={{ aspectRatio: `${props.width} / ${props.height}` }}
      >
        <Image
          src={props.previewUrl}
          alt={m.editorV2ResultAlt()}
          preset="preview"
          width={props.width}
          height={props.height}
          className="absolute inset-0 size-full object-contain"
        />
      </div>

      <fieldset className="grid gap-3" disabled={busy}>
        <legend>
          <Typography variant="label" as="span">
            {m.editorV2EnhancementsOperations()}
          </Typography>
        </legend>
        <label className="border-border bg-background grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-lg border p-3">
          <input
            type="checkbox"
            className="accent-primary mt-1 size-4"
            checked={props.draft.selectedOperationIds.includes("fine-detail")}
            onChange={() => toggleOperation("fine-detail")}
          />
          <span>
            <Typography variant="body-small" as="span">
              {m.editorV2EnhancementsFineDetail()}
            </Typography>
            <Typography
              variant="caption"
              as="span"
              className="text-muted-foreground mt-1 block"
            >
              {m.editorV2EnhancementsFineDetailHelp()}
            </Typography>
          </span>
        </label>
        <label className="border-border bg-background grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-lg border p-3">
          <input
            type="checkbox"
            className="accent-primary mt-1 size-4"
            checked={props.draft.selectedOperationIds.includes("colour-halo")}
            onChange={() => toggleOperation("colour-halo")}
          />
          <span>
            <Typography variant="body-small" as="span">
              {m.editorV2EnhancementsColourHalo()}
            </Typography>
            <Typography
              variant="caption"
              as="span"
              className="text-muted-foreground mt-1 block"
            >
              {m.editorV2EnhancementsColourHaloHelp()}
            </Typography>
          </span>
        </label>
      </fieldset>

      {props.runtime.fraction !== null ? (
        <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden="true">
          <div
            className="bg-primary h-full transition-[width] duration-200"
            style={{ width: `${Math.round(props.runtime.fraction * 100)}%` }}
          />
        </div>
      ) : null}
      <Typography
        variant="body-small"
        as="p"
        role={props.runtime.status === "error" ? "alert" : "status"}
        aria-live="polite"
        className={
          props.runtime.status === "error" ? "text-destructive" : "text-muted-foreground"
        }
      >
        {runtimeStatus(props)}
      </Typography>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => props.session.cancelEnhancements()}>
          {m.editorV2Cancel()}
        </Button>
        {props.runtime.status === "error" || props.runtime.status === "no-change" ? (
          <Button
            variant="outline"
            onClick={() => props.session.retryEnhancements()}
            disabled={props.draft.selectedOperationIds.length === 0}
          >
            {m.editorV2Retry()}
          </Button>
        ) : null}
        <Button
          onClick={() => props.session.applyEnhancements()}
          disabled={busy || props.draft.selectedOperationIds.length === 0}
        >
          {m.editorV2Apply()}
        </Button>
      </div>
    </section>
  );
}
