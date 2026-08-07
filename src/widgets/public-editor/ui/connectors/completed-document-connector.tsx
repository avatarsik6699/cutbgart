import { availableExportSizes, DownloadControl } from "@/features/download-result";
import { getLocale } from "@/paraglide/runtime";
import type { EditorSessionTypes } from "@/v2/runtime-browser";

import {
  useEditorSessionSelector,
  usePublicEditorModel,
  usePublicEditorViewSelector,
  type PublicEditorViewSnapshot,
} from "../../model";
import { EditorV2ActiveDocument } from "../editor-v2-active-document";
import { BatchActionsConnector, BatchRailConnector } from "./batch-connectors";

const selectActiveSnapshot = (
  snapshot: EditorSessionTypes.Snapshot,
): EditorSessionTypes.ActiveSnapshot | null =>
  snapshot.kind === "document" ? snapshot : null;
const selectBatchMode = (snapshot: PublicEditorViewSnapshot) => snapshot.batchMode;
const selectExportSize = (snapshot: PublicEditorViewSnapshot) => snapshot.exportSize;

export function CompletedDocumentConnector() {
  const model = usePublicEditorModel();
  const snapshot = useEditorSessionSelector(selectActiveSnapshot);
  const batchMode = usePublicEditorViewSelector(selectBatchMode);
  const exportSize = usePublicEditorViewSelector(selectExportSize);
  if (snapshot === null) return null;

  const sizes = availableExportSizes({ width: snapshot.width, height: snapshot.height });
  const selectedSize = sizes.includes(exportSize) ? exportSize : "original";
  const singleExport = model.session.singleExportSnapshot();

  return (
    <div className="space-y-4">
      {batchMode ? <BatchRailConnector /> : null}
      <EditorV2ActiveDocument
        key={snapshot.actor.id}
        locale={getLocale()}
        onLeave={model.leaveDocument}
        session={model.session}
        snapshot={snapshot}
        DownloadSlot={
          <DownloadControl
            busy={singleExport.status === "preparing"}
            error={singleExport.error}
            onDownload={model.downloadSelected}
            onRetry={model.downloadSelected}
            onSelectSize={model.chooseExportSize}
            onUseOriginal={() => model.chooseExportSize("original")}
            selectedSize={selectedSize}
            sizes={sizes}
          />
        }
        WorkspaceActionsSlot={
          batchMode ? <BatchActionsConnector disabled={false} /> : undefined
        }
      />
    </div>
  );
}
