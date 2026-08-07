import { useMemo } from "react";

import { m } from "@/paraglide/messages";
import {
  MainPageBatchActions,
  MainPageBatchRail,
  type MainPageEditorTypes,
} from "@/v2/presentation";
import type { EditorSessionTypes } from "@/v2/runtime-browser";

import {
  useEditorWorkspaceSelector,
  usePublicEditorModel,
  usePublicEditorViewSelector,
  type PublicEditorViewSnapshot,
} from "../../model";

function batchItemError(
  item: EditorSessionTypes.ItemSummary,
): { message: string; retryable: boolean } | null {
  if (item.error === null) return null;
  if (typeof item.error !== "string")
    return { message: item.error.message, retryable: item.error.retryable };
  if (item.error === "exceeds-size-limit")
    return { message: m.uploadTooLarge(), retryable: true };
  if (item.error === "unsupported-file")
    return { message: m.uploadUnsupported({ format: "unknown" }), retryable: true };
  return { message: m.editorV2InvalidImage(), retryable: true };
}

const selectWorkspace = (
  snapshot: EditorSessionTypes.WorkspaceSnapshot,
): EditorSessionTypes.WorkspaceSnapshot => snapshot;
const selectAdmissionError = (snapshot: PublicEditorViewSnapshot) =>
  snapshot.batchAdmissionError;
const selectQualityMode = (snapshot: PublicEditorViewSnapshot) => snapshot.qualityMode;

function useBatchProjection(): MainPageEditorTypes.BatchProjection {
  const workspace = useEditorWorkspaceSelector(selectWorkspace);
  const admissionError = usePublicEditorViewSelector(selectAdmissionError);

  return useMemo(
    () => ({
      admissionError,
      capacity: { current: workspace.items.length, limit: 20 },
      counts: {
        active: workspace.items.filter(
          (item) =>
            item.status === "preparing" ||
            item.status === "model-loading" ||
            item.status === "processing",
        ).length,
        queued: workspace.items.filter((item) => item.status === "queued").length,
        completed: workspace.items.filter((item) => item.status === "result").length,
        failed: workspace.items.filter((item) => item.status === "error").length,
      },
      export: workspace.export,
      items: workspace.items.map((item) => ({
        ...item,
        error: batchItemError(item),
        selected: item.documentId === workspace.selectedDocumentId,
      })),
    }),
    [admissionError, workspace],
  );
}

export function BatchRailConnector() {
  const model = usePublicEditorModel();
  const batch = useBatchProjection();

  return (
    <MainPageBatchRail
      batch={batch}
      onDownload={model.downloadBatchItem}
      onRemove={model.removeBatchItem}
      onRetry={model.retryBatchItem}
      onSelect={model.selectBatchDocument}
    />
  );
}

type ActionsProps = Readonly<{ disabled: boolean }>;

export function BatchActionsConnector(props: ActionsProps) {
  const model = usePublicEditorModel();
  const batch = useBatchProjection();
  const qualityMode = usePublicEditorViewSelector(selectQualityMode);

  return (
    <MainPageBatchActions
      batch={batch}
      disabled={props.disabled}
      onAddFiles={(files) => void model.admitFiles(files)}
      onCancelDownloadAll={model.cancelDownloadAll}
      onChooseQualityMode={model.chooseQualityMode}
      onDownloadAll={model.downloadAll}
      qualityMode={qualityMode}
    />
  );
}
