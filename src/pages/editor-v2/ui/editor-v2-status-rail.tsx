import { m } from "@/paraglide/messages";
import type { DocumentStatus } from "@/v2/domain";
import { Typography } from "@/v2/shared/ui";

type Props = {
  status: DocumentStatus | "empty";
};

const STAGES: readonly DocumentStatus[] = [
  "preparing",
  "queued",
  "model-loading",
  "processing",
  "committing",
  "result",
];

function stageLabel(status: DocumentStatus): string {
  const labels: Record<DocumentStatus, () => string> = {
    preparing: m.editorV2StagePreparing,
    ready: m.editorV2StageReady,
    queued: m.editorV2StageQueued,
    "model-loading": m.editorV2StageModelLoading,
    processing: m.editorV2StageProcessing,
    cancelling: m.editorV2StageCancelling,
    committing: m.editorV2StageCommitting,
    "manual-applying": m.editorV2StageCommitting,
    result: m.editorV2StageResult,
    error: m.editorV2StageError,
    disposed: m.editorV2StageDisposed,
  };
  return labels[status]();
}

function stageMarkerClassName(index: number, activeIndex: number): string {
  if (index === activeIndex) {
    return "bg-primary text-primary-foreground font-mono text-[0.65rem] grid size-5 place-items-center rounded-full";
  }
  if (index < activeIndex) {
    return "bg-local text-local-foreground font-mono text-[0.65rem] grid size-5 place-items-center rounded-full";
  }
  return "border-border text-muted-foreground font-mono text-[0.65rem] grid size-5 place-items-center rounded-full border";
}

function currentIndex(status: Props["status"]): number {
  if (status === "empty") return -1;
  if (status === "ready") return 0;
  if (status === "cancelling" || status === "error") return 3;
  if (status === "disposed") return -1;
  return STAGES.indexOf(status);
}

export function EditorV2StatusRail(props: Props) {
  const activeIndex = currentIndex(props.status);

  return (
    <aside
      className="border-border bg-card/60 rounded-xl border p-4 sm:p-5"
      aria-label={m.editorV2ProcessingStages()}
    >
      <Typography
        variant="label"
        as="h2"
        className="text-muted-foreground mb-4 uppercase tracking-[0.16em]"
      >
        {m.editorV2LocalProcess()}
      </Typography>
      <ol className="space-y-1">
        {STAGES.map((stage, index) => (
          <li
            key={stage}
            className="border-border grid grid-cols-[1.75rem_1fr] items-center gap-2 border-t py-2 first:border-t-0"
            aria-current={index === activeIndex ? "step" : undefined}
          >
            <span className={stageMarkerClassName(index, activeIndex)}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <Typography
              variant="caption"
              as="span"
              className={
                index === activeIndex ? "text-foreground" : "text-muted-foreground"
              }
            >
              {stageLabel(stage)}
            </Typography>
          </li>
        ))}
      </ol>
    </aside>
  );
}
