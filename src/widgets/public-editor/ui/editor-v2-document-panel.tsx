import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import type { DocumentStatus } from "@/v2/domain";
import type { EditorSession } from "@/v2/runtime-browser";
import { Typography } from "@/v2/shared/ui";

import { EditorV2StatusRail } from "./editor-v2-status-rail";

export type EditorV2DocumentPanelProps = {
  backgroundOpen: boolean;
  canRedoDocument: boolean;
  canUndoDocument: boolean;
  enhancementOpen: boolean;
  manualOpen: boolean;
  magicOpen: boolean;
  revision: number;
  progress: number | null;
  showPrimaryActions?: boolean;
  session: EditorSession;
  status: DocumentStatus;
  onBeginManual(button: HTMLButtonElement): void;
  onBeginMagic(button: HTMLButtonElement): void;
  onBeginBackground(button: HTMLButtonElement): void;
  onBeginEnhancements(button: HTMLButtonElement): void;
};

function statusMessage(status: DocumentStatus): string {
  if (status === "cancelling") return m.editorV2Stopping();
  if (status === "error") return m.editorV2ProcessingFailed();
  if (status === "manual-applying") return m.editorV2ManualApplying();
  if (status === "magic-applying") return m.editorV2MagicApplying();
  if (status === "magic-predicting") return m.editorV2MagicPredicting();
  if (status === "background-applying") return m.editorV2BackgroundApplying();
  if (status === "enhancement-queued") return m.editorV2EnhancementsQueued();
  if (status === "enhancement-running") return m.editorV2EnhancementsRunning();
  if (status === "enhancement-applying") return m.editorV2EnhancementsApplying();
  return m.editorV2Privacy();
}

export function EditorV2DocumentPanel(props: EditorV2DocumentPanelProps) {
  const showPrimaryActions = props.showPrimaryActions ?? true;
  const canCancel = ["queued", "model-loading", "processing"].includes(props.status);
  const canRetry = props.status === "error" || props.status === "ready";
  const draftOpen =
    props.manualOpen || props.magicOpen || props.backgroundOpen || props.enhancementOpen;
  const canExport = props.status === "result";
  const canOpenTool = props.status === "result" && !draftOpen;

  return (
    <div className="space-y-4">
      <EditorV2StatusRail status={props.status} />
      <section
        className="border-border bg-card/60 rounded-xl border p-4 sm:p-5"
        aria-live="polite"
      >
        <Typography
          variant="label"
          as="h2"
          className="text-muted-foreground uppercase tracking-[0.16em]"
        >
          {m.editorV2StateHeading()}
        </Typography>
        <Typography variant="body-small" as="p" className="mt-2">
          {statusMessage(props.status)}
        </Typography>
        <Typography
          variant="caption"
          as="p"
          className="text-muted-foreground mt-1 font-mono"
        >
          {m.editorV2Revision({ revision: String(props.revision) })}
        </Typography>
        <Typography variant="caption" as="p" className="text-muted-foreground mt-2">
          {m.editorV2Shortcuts()}
        </Typography>
        {props.progress !== null ? (
          <div
            className="mt-4"
            role="progressbar"
            aria-label={m.editorV2Progress()}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(props.progress * 100)}
          >
            <div
              className="bg-muted h-1.5 overflow-hidden rounded-full"
              aria-hidden="true"
            >
              <div
                className="bg-primary h-full transition-[width] duration-200"
                style={{ width: `${Math.round(props.progress * 100)}%` }}
              />
            </div>
            <Typography
              variant="caption"
              as="p"
              className="text-muted-foreground mt-2 font-mono"
            >
              {Math.round(props.progress * 100)}%
            </Typography>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {showPrimaryActions && canCancel ? (
            <Button variant="outline" onClick={() => props.session.cancel()}>
              {m.editorV2Cancel()}
            </Button>
          ) : null}
          {showPrimaryActions && canRetry ? (
            <Button onClick={() => props.session.retry()}>{m.editorV2Retry()}</Button>
          ) : null}
          {showPrimaryActions && canExport ? (
            <Button
              onClick={() => {
                void props.session.exportPng();
              }}
            >
              {draftOpen ? m.editorV2DownloadCommittedPng() : m.editorV2DownloadPng()}
            </Button>
          ) : null}
          <Button
            variant="outline"
            disabled={!canOpenTool}
            onClick={(event) => props.onBeginManual(event.currentTarget)}
          >
            {m.editorV2ManualTitle()}
          </Button>
          <Button
            variant="outline"
            disabled={!canOpenTool}
            onClick={(event) => props.onBeginMagic(event.currentTarget)}
          >
            {m.editorV2MagicTitle()}
          </Button>
          <Button
            variant="outline"
            disabled={!canOpenTool}
            onClick={(event) => props.onBeginBackground(event.currentTarget)}
          >
            {m.editorV2BackgroundTitle()}
          </Button>
          <Button
            variant="outline"
            disabled={!canOpenTool}
            onClick={(event) => props.onBeginEnhancements(event.currentTarget)}
          >
            {m.editorV2EnhancementsTitle()}
          </Button>
          <Button
            variant="outline"
            onClick={() => props.session.undoDocument()}
            disabled={!props.canUndoDocument}
          >
            {m.editorV2DocumentUndo()}
          </Button>
          <Button
            variant="outline"
            onClick={() => props.session.redoDocument()}
            disabled={!props.canRedoDocument}
          >
            {m.editorV2DocumentRedo()}
          </Button>
          {showPrimaryActions ? (
            <Button
              variant="ghost"
              onClick={() => props.session.reset()}
              disabled={
                props.status === "cancelling" ||
                props.status === "manual-applying" ||
                props.status === "magic-applying" ||
                draftOpen
              }
            >
              {m.editorV2StartOver()}
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
