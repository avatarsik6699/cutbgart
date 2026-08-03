import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import type { DocumentStatus } from "@/v2/domain";
import type { EditorSession } from "@/v2/runtime-browser";
import { Typography } from "@/v2/shared/ui";

import { EditorV2StatusRail } from "./editor-v2-status-rail";

type Props = {
  progress: number | null;
  session: EditorSession;
  status: DocumentStatus;
};

function statusMessage(status: DocumentStatus): string {
  if (status === "cancelling") return m.editorV2Stopping();
  if (status === "error") return m.editorV2ProcessingFailed();
  return m.editorV2Privacy();
}

export function EditorV2DocumentPanel(props: Props) {
  const canCancel = ["queued", "model-loading", "processing"].includes(props.status);
  const canRetry = props.status === "error" || props.status === "ready";
  const canExport = props.status === "result";

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
        {props.progress !== null ? (
          <div className="mt-4">
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
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
          {canCancel ? (
            <Button variant="outline" onClick={() => props.session.cancel()}>
              {m.editorV2Cancel()}
            </Button>
          ) : null}
          {canRetry ? (
            <Button onClick={() => props.session.retry()}>{m.editorV2Retry()}</Button>
          ) : null}
          {canExport ? (
            <Button onClick={() => props.session.exportPng()}>
              {m.editorV2DownloadPng()}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => props.session.reset()}
            disabled={props.status === "cancelling"}
          >
            {m.editorV2StartOver()}
          </Button>
        </div>
      </section>
    </div>
  );
}
