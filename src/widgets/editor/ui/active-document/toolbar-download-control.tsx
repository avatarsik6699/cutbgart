import { availableExportSizes, DownloadControl } from "@/features/download-result";

import {
  selectActiveHeight,
  selectActiveWidth,
  selectSingleExportSnapshot,
  useActiveDocumentModel,
  useEditorSessionValue,
  useEditorViewSelector,
  type EditorViewSnapshot,
} from "../../model";

const selectExportSize = (snapshot: EditorViewSnapshot) => snapshot.exportSize;

export function ToolbarDownloadControl() {
  const document = useActiveDocumentModel();
  const exportSize = useEditorViewSelector(selectExportSize);
  const width = useEditorSessionValue(selectActiveWidth);
  const height = useEditorSessionValue(selectActiveHeight);
  const singleExport = useEditorSessionValue(selectSingleExportSnapshot);
  const sizes = availableExportSizes({ width, height });
  const selectedSize = sizes.includes(exportSize) ? exportSize : "original";

  return (
    <DownloadControl
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
