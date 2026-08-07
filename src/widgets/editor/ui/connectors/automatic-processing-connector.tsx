import { useSelector } from "@xstate/react";

import {
  selectDocumentProgress,
  selectDocumentStatus,
  type DocumentMachineTypes,
} from "@/editor/application";
import type { DocumentStatus } from "@/editor/domain";
import {
  ProcessingRecovery,
  ProcessingStatus,
  SingleImageStage,
  isAutomaticProcessingPhase,
  processingStatusText,
  type MainPageEditorTypes,
} from "../main-page";
import { EditorToolbar, LocalExecutionReadout } from "../editor-tools";
import type { EditorSessionTypes } from "@/editor/runtime";
import { Skeleton, Typography } from "@/shared/ui";
import { m } from "@/paraglide/messages";

import {
  useEditorSessionSelector,
  useEditorSessionValue,
  useEditorModel,
  useEditorViewSelector,
  type EditorViewSnapshot,
} from "../../model";
import { BatchActionsConnector, BatchRailConnector } from "./batch-connectors";

type Props = Readonly<{ actor: DocumentMachineTypes.ActorRef | null }>;

const selectSnapshotKind = (snapshot: EditorSessionTypes.Snapshot) => snapshot.kind;
const selectAdmissionError = (snapshot: EditorSessionTypes.Snapshot) => snapshot.error;
const selectHeight = (snapshot: EditorSessionTypes.Snapshot) => snapshot.height;
const selectPreviewUrl = (snapshot: EditorSessionTypes.Snapshot) => snapshot.previewUrl;
const selectResultUrl = (snapshot: EditorSessionTypes.Snapshot) => snapshot.resultUrl;
const selectWidth = (snapshot: EditorSessionTypes.Snapshot) => snapshot.width;
const selectFallbackUsed = (session: EditorSessionTypes.Session) =>
  session.processingSelection()?.fallbackUsed ?? false;
const selectInferencePath = (session: EditorSessionTypes.Session) =>
  session.processingSelection()?.inferencePath ?? "wasm";
const selectBatchMode = (snapshot: EditorViewSnapshot) => snapshot.batchMode;
const selectQualityMode = (snapshot: EditorViewSnapshot) => snapshot.qualityMode;

function automaticProcessingPhase(status: DocumentStatus): MainPageEditorTypes.Phase {
  switch (status) {
    case "model-loading":
      return "loading-model";
    case "result":
      return "result";
    case "error":
    case "ready":
      return "error";
    default:
      return "processing";
  }
}

function inactivePhase(
  kind: EditorSessionTypes.Snapshot["kind"],
  error: EditorSessionTypes.ImportError | null,
): MainPageEditorTypes.Phase {
  if (error !== null) return "error";
  if (kind === "preparing") return "preparing";
  return "empty";
}

function AutomaticDocumentWorkspace(props: { actor: DocumentMachineTypes.ActorRef }) {
  const status = useSelector(props.actor, selectDocumentStatus);
  const progress = useSelector(props.actor, selectDocumentProgress);
  return (
    <AutomaticProcessingContent
      phase={automaticProcessingPhase(status)}
      progress={progress}
    />
  );
}

function AutomaticProcessingContent(props: {
  phase: MainPageEditorTypes.Phase;
  progress: number | null;
}) {
  const model = useEditorModel();
  const batchMode = useEditorViewSelector(selectBatchMode);
  const qualityMode = useEditorViewSelector(selectQualityMode);
  const fallbackUsed = useEditorSessionValue(selectFallbackUsed);
  const inferencePath = useEditorSessionValue(selectInferencePath);
  const height = useEditorSessionSelector(selectHeight);
  const width = useEditorSessionSelector(selectWidth);
  const previewUrl = useEditorSessionSelector(selectPreviewUrl);
  const resultUrl = useEditorSessionSelector(selectResultUrl);
  const busy = isAutomaticProcessingPhase(props.phase);
  const statusText = processingStatusText(
    props.phase,
    qualityMode,
    props.progress === null ? null : Math.round(props.progress * 100),
  );

  return (
    <div
      data-testid="tool-workspace"
      data-main-page-phase={props.phase}
      className={`tool-workspace-grid ${batchMode ? "tool-workspace-batch" : ""}`}
    >
      <ProcessingStatus fallbackUsed={fallbackUsed} statusText={statusText} />
      {batchMode ? (
        <div className="[grid-area:batch]">
          <BatchRailConnector />
        </div>
      ) : null}
      <div className="min-w-0 overflow-hidden [grid-area:toolbar]">
        <EditorToolbar
          onBack={busy ? model.cancelProcessing : model.reset}
          StatusSlot={<LocalExecutionReadout busy={busy} inferencePath={inferencePath} />}
          WorkspaceActionsSlot={
            batchMode ? <BatchActionsConnector disabled={busy} /> : undefined
          }
        />
      </div>
      {props.phase === "error" ? (
        <ProcessingRecovery
          onReset={model.reset}
          onRetry={model.retryProcessing}
          retryable
        />
      ) : null}
      <SingleImageStage
        committedResultUrl={resultUrl}
        EmptyState={
          batchMode ? (
            <Typography
              variant="body-small"
              as="p"
              className="max-w-sm text-center text-muted-foreground"
            >
              {m.batchEditorEmpty()}
            </Typography>
          ) : undefined
        }
        height={height}
        loadingText={statusText}
        phase={props.phase}
        sourcePreviewUrl={previewUrl}
        width={width}
      />
      <div className="[grid-area:rail]">
        <Skeleton className="min-h-[clamp(22rem,62dvh,46rem)] rounded-lg border border-border" />
      </div>
    </div>
  );
}

export function AutomaticProcessingConnector(props: Props) {
  const kind = useEditorSessionSelector(selectSnapshotKind);
  const error = useEditorSessionSelector(selectAdmissionError);
  if (props.actor !== null) return <AutomaticDocumentWorkspace actor={props.actor} />;
  return (
    <AutomaticProcessingContent phase={inactivePhase(kind, error)} progress={null} />
  );
}
