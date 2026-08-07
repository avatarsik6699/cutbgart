import { useMemo } from "react";

import { m } from "@/paraglide/messages";
import {
  MainPageBatchActions,
  MainPageBatchRail,
  type MainPageEditorTypes,
} from "../main-page";
import type { EditorSessionTypes } from "@/editor/runtime";

import {
  useEditorWorkspaceSelector,
  useEditorModel,
  useEditorViewSelector,
  type EditorViewSnapshot,
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
  return { message: m.editorInvalidImage(), retryable: true };
}

const selectWorkspace = (
  snapshot: EditorSessionTypes.WorkspaceSnapshot,
): EditorSessionTypes.WorkspaceSnapshot => snapshot;
const selectAdmissionError = (snapshot: EditorViewSnapshot) =>
  snapshot.batchAdmissionError;
const selectQualityMode = (snapshot: EditorViewSnapshot) => snapshot.qualityMode;
const selectItemCount = (snapshot: EditorSessionTypes.WorkspaceSnapshot) =>
  snapshot.items.length;
const selectCompletedCount = (snapshot: EditorSessionTypes.WorkspaceSnapshot) => {
  let count = 0;
  for (const item of snapshot.items) if (item.status === "result") count += 1;
  return count;
};
const selectExporting = (snapshot: EditorSessionTypes.WorkspaceSnapshot) =>
  snapshot.export.status === "preparing";

function useBatchRailProjection(): MainPageEditorTypes.BatchProjection {
  const workspace = useEditorWorkspaceSelector(selectWorkspace);
  const admissionError = useEditorViewSelector(selectAdmissionError);

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
  const model = useEditorModel();
  const batch = useBatchRailProjection();

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

export function BatchActionsConnector(props: Readonly<{ disabled: boolean }>) {
  const model = useEditorModel();
  const qualityMode = useEditorViewSelector(selectQualityMode);
  const itemCount = useEditorWorkspaceSelector(selectItemCount);
  const completedCount = useEditorWorkspaceSelector(selectCompletedCount);
  const exporting = useEditorWorkspaceSelector(selectExporting);

  return (
    <MainPageBatchActions
      actions={{ atCapacity: itemCount >= 20, completedCount, exporting }}
      disabled={props.disabled}
      onAddFiles={(files) => void model.admitFiles(files)}
      onCancelDownloadAll={model.cancelDownloadAll}
      onChooseQualityMode={model.chooseQualityMode}
      onDownloadAll={model.downloadAll}
      qualityMode={qualityMode}
    />
  );
}
