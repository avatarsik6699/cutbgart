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
import {
  AutomaticModelControl,
  EditorToolbar,
  LocalExecutionReadout,
} from "../editor-tools";
import type { EditorSessionTypes } from "@/editor/runtime";
import { Button, Skeleton, Typography } from "@/shared/ui";
import type { AutomaticModelMode, BrowserInferencePath } from "@/shared/lib";
import { m } from "@/paraglide/messages";

import {
  selectAvailableModelModes,
  selectCurrentModelMode,
  selectInferencePath,
  selectProcessingModelMode,
  useEditorSessionSelector,
  useEditorSessionValue,
  useEditorModel,
  useEditorViewSelector,
  useEditorWorkspaceSelector,
  type EditorViewSnapshot,
} from "../../model";
import { BatchActionsConnector, BatchRailConnector } from "./batch-connectors";

const selectSnapshotKind = (snapshot: EditorSessionTypes.Snapshot) => snapshot.kind;
const selectAdmissionError = (snapshot: EditorSessionTypes.Snapshot) => snapshot.error;
const selectHeight = (snapshot: EditorSessionTypes.Snapshot) => snapshot.height;
const selectPreviewUrl = (snapshot: EditorSessionTypes.Snapshot) => snapshot.previewUrl;
const selectResultUrl = (snapshot: EditorSessionTypes.Snapshot) => snapshot.resultUrl;
const selectWidth = (snapshot: EditorSessionTypes.Snapshot) => snapshot.width;
const selectFallbackUsed = (session: EditorSessionTypes.Session) =>
  session.processingSelection()?.fallbackUsed ?? false;
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
  return (
    <AutomaticProcessingContent
      actor={props.actor}
      phase={automaticProcessingPhase(status)}
    />
  );
}

function AutomaticProcessingContent(props: {
  actor: DocumentMachineTypes.ActorRef | null;
  phase: MainPageEditorTypes.Phase;
}) {
  const batchMode = useEditorViewSelector(selectBatchMode);
  const busy = isAutomaticProcessingPhase(props.phase);

  return (
    <div
      data-testid="tool-workspace"
      data-main-page-phase={props.phase}
      className={`tool-workspace-grid ${batchMode ? "tool-workspace-batch" : ""}`}
    >
      <ProcessingStatusConnector actor={props.actor} phase={props.phase} />
      {batchMode ? (
        <div className="[grid-area:batch]">
          <BatchRailConnector />
        </div>
      ) : null}
      <div className="min-w-0 overflow-hidden [grid-area:toolbar]">
        <AutomaticToolbar batchMode={batchMode} busy={busy} />
      </div>
      {props.phase === "error" ? <AutomaticProcessingRecovery /> : null}
      <SingleImageStageConnector
        actor={props.actor}
        batchMode={batchMode}
        phase={props.phase}
      />
      <div className="[grid-area:rail]">
        <Skeleton className="min-h-stage-lg rounded-lg border border-border" />
      </div>
    </div>
  );
}

function useProcessingStatusText(
  phase: MainPageEditorTypes.Phase,
  progress: number | null,
): string {
  const qualityMode = useEditorViewSelector(selectQualityMode);
  return processingStatusText(
    phase,
    qualityMode,
    progress === null ? null : Math.round(progress * 100),
  );
}

function AutomaticProcessingStatus(props: {
  actor: DocumentMachineTypes.ActorRef;
  phase: MainPageEditorTypes.Phase;
}) {
  const progress = useSelector(props.actor, selectDocumentProgress);
  return <ProcessingStatusView phase={props.phase} progress={progress} />;
}

function ProcessingStatusConnector(props: {
  actor: DocumentMachineTypes.ActorRef | null;
  phase: MainPageEditorTypes.Phase;
}) {
  if (props.actor !== null)
    return <AutomaticProcessingStatus actor={props.actor} phase={props.phase} />;
  return <ProcessingStatusView phase={props.phase} progress={null} />;
}

function ProcessingStatusView(props: {
  phase: MainPageEditorTypes.Phase;
  progress: number | null;
}) {
  const fallbackUsed = useEditorSessionValue(selectFallbackUsed);
  const statusText = useProcessingStatusText(props.phase, props.progress);
  return (
    <ProcessingStatus
      fallbackUsed={fallbackUsed}
      processing={isAutomaticProcessingPhase(props.phase)}
      statusText={statusText}
    />
  );
}

function AutomaticToolbarStatusSlot(props: {
  availableModes: readonly AutomaticModelMode[];
  busy: boolean;
  currentMode: AutomaticModelMode | null;
  inferencePath: BrowserInferencePath;
  processingMode: AutomaticModelMode | null;
}) {
  if (props.currentMode === null && props.processingMode === null)
    return (
      <LocalExecutionReadout busy={props.busy} inferencePath={props.inferencePath} />
    );
  return (
    <AutomaticModelControl
      availableModes={props.availableModes}
      busy={props.busy}
      currentMode={props.currentMode}
      inferencePath={props.inferencePath}
      processingMode={props.processingMode}
    />
  );
}

const selectBatchCompletedCount = (snapshot: EditorSessionTypes.WorkspaceSnapshot) => {
  let count = 0;
  for (const item of snapshot.items) if (item.status === "result") count += 1;
  return count;
};
const selectBatchExporting = (snapshot: EditorSessionTypes.WorkspaceSnapshot) =>
  snapshot.export.status === "preparing";

/** Only reachable while the currently selected batch item has not yet reached
 * "result" itself, so it cannot host the post-result `ToolbarDownloadControl`
 * split button; kept as a plain button rather than folding it into a split
 * button with no "current document" action to pair it with. */
function BatchZipDownloadSlot() {
  const model = useEditorModel();
  const completedCount = useEditorWorkspaceSelector(selectBatchCompletedCount);
  const exporting = useEditorWorkspaceSelector(selectBatchExporting);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={completedCount === 0 && !exporting}
      onClick={exporting ? model.cancelDownloadAll : model.downloadAll}
    >
      {exporting ? m.cancel() : m.downloadAllZip()}
    </Button>
  );
}

function AutomaticToolbar(props: { batchMode: boolean; busy: boolean }) {
  const model = useEditorModel();
  const availableModes = useEditorSessionValue(selectAvailableModelModes);
  const currentMode = useEditorSessionValue(selectCurrentModelMode);
  const inferencePath = useEditorSessionValue(selectInferencePath);
  const processingMode = useEditorSessionValue(selectProcessingModelMode);
  return (
    <EditorToolbar
      onBack={props.busy ? model.cancelProcessing : model.reset}
      StatusSlot={
        props.batchMode ? undefined : (
          <AutomaticToolbarStatusSlot
            availableModes={availableModes}
            busy={props.busy}
            currentMode={currentMode}
            inferencePath={inferencePath}
            processingMode={processingMode}
          />
        )
      }
      WorkspaceActionsSlot={
        props.batchMode ? <BatchActionsConnector disabled={props.busy} /> : undefined
      }
      DownloadSlot={props.batchMode ? <BatchZipDownloadSlot /> : undefined}
    />
  );
}

function AutomaticProcessingRecovery() {
  const model = useEditorModel();
  return (
    <ProcessingRecovery onReset={model.reset} onRetry={model.retryProcessing} retryable />
  );
}

function AutomaticSingleImageStage(props: {
  actor: DocumentMachineTypes.ActorRef;
  batchMode: boolean;
  phase: MainPageEditorTypes.Phase;
}) {
  const progress = useSelector(props.actor, selectDocumentProgress);
  return (
    <SingleImageStageView
      batchMode={props.batchMode}
      phase={props.phase}
      progress={progress}
    />
  );
}

function SingleImageStageConnector(props: {
  actor: DocumentMachineTypes.ActorRef | null;
  batchMode: boolean;
  phase: MainPageEditorTypes.Phase;
}) {
  if (props.actor !== null)
    return (
      <AutomaticSingleImageStage
        actor={props.actor}
        batchMode={props.batchMode}
        phase={props.phase}
      />
    );
  return (
    <SingleImageStageView
      batchMode={props.batchMode}
      phase={props.phase}
      progress={null}
    />
  );
}

function SingleImageStageView(props: {
  batchMode: boolean;
  phase: MainPageEditorTypes.Phase;
  progress: number | null;
}) {
  const height = useEditorSessionSelector(selectHeight);
  const width = useEditorSessionSelector(selectWidth);
  const previewUrl = useEditorSessionSelector(selectPreviewUrl);
  const resultUrl = useEditorSessionSelector(selectResultUrl);
  const statusText = useProcessingStatusText(props.phase, props.progress);
  return (
    <SingleImageStage
      committedResultUrl={resultUrl}
      EmptyState={
        props.batchMode ? (
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
  );
}

export function AutomaticProcessingConnector(
  props: Readonly<{ actor: DocumentMachineTypes.ActorRef | null }>,
) {
  const kind = useEditorSessionSelector(selectSnapshotKind);
  const error = useEditorSessionSelector(selectAdmissionError);
  if (props.actor !== null) return <AutomaticDocumentWorkspace actor={props.actor} />;
  return <AutomaticProcessingContent actor={null} phase={inactivePhase(kind, error)} />;
}
