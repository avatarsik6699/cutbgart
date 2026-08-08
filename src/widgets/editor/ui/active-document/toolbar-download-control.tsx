import { m } from "@/paraglide/messages";
import { availableExportSizes, DownloadControl } from "@/features/download-result";
import type { EditorSessionTypes } from "@/editor/runtime";
import type { ComponentProps } from "react";

import {
  selectActiveHeight,
  selectActiveWidth,
  selectSingleExportSnapshot,
  useActiveDocumentModel,
  useEditorModel,
  useEditorSessionValue,
  useEditorViewSelector,
  useEditorWorkspaceSelector,
  type EditorViewSnapshot,
} from "../../model";

const selectExportSize = (snapshot: EditorViewSnapshot) => snapshot.exportSize;
const selectBatchMode = (snapshot: EditorViewSnapshot) => snapshot.batchMode;
const selectCompletedCount = (snapshot: EditorSessionTypes.WorkspaceSnapshot) => {
  let count = 0;
  for (const item of snapshot.items) if (item.status === "result") count += 1;
  return count;
};
const selectExporting = (snapshot: EditorSessionTypes.WorkspaceSnapshot) =>
  snapshot.export.status === "preparing";

function batchZipOption(
  batchMode: boolean,
  exporting: boolean,
  completedCount: number,
  model: ReturnType<typeof useEditorModel>,
): ComponentProps<typeof DownloadControl>["batchZip"] {
  if (!batchMode) return undefined;
  return {
    busy: exporting,
    disabled: !exporting && completedCount === 0,
    label: exporting ? m.cancel() : m.downloadAllZip(),
    onClick: exporting ? model.cancelDownloadAll : model.downloadAll,
  };
}

export function ToolbarDownloadControl() {
  const document = useActiveDocumentModel();
  const model = useEditorModel();
  const exportSize = useEditorViewSelector(selectExportSize);
  const batchMode = useEditorViewSelector(selectBatchMode);
  const width = useEditorSessionValue(selectActiveWidth);
  const height = useEditorSessionValue(selectActiveHeight);
  const singleExport = useEditorSessionValue(selectSingleExportSnapshot);
  const completedCount = useEditorWorkspaceSelector(selectCompletedCount);
  const exporting = useEditorWorkspaceSelector(selectExporting);
  const sizes = availableExportSizes({ width, height });
  const selectedSize = sizes.includes(exportSize) ? exportSize : "original";
  const batchZip = batchZipOption(batchMode, exporting, completedCount, model);

  return (
    <DownloadControl
      batchZip={batchZip}
      busy={singleExport.status === "preparing"}
      error={singleExport.error}
      onDownload={document.editor.downloadSelected}
      onRetry={document.editor.downloadSelected}
      onSelectSize={document.editor.chooseExportSize}
      onUseOriginal={() => document.editor.chooseExportSize("original")}
      selectedSize={selectedSize}
      sizes={sizes}
    />
  );
}
