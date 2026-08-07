import { availableExportSizes, DownloadControl } from "@/features/download-result";
import { getLocale } from "@/paraglide/runtime";
import type { EditorSessionTypes } from "@/editor/runtime";

import {
  useEditorSessionSelector,
  useEditorModel,
  useEditorViewSelector,
  type EditorViewSnapshot,
} from "../../model";
import { ActiveDocument } from "../active-document";
import { BatchActionsConnector, BatchRailConnector } from "./batch-connectors";

const selectActiveSnapshot = (
  snapshot: EditorSessionTypes.Snapshot,
): EditorSessionTypes.ActiveSnapshot | null =>
  snapshot.kind === "document" ? snapshot : null;
const selectBatchMode = (snapshot: EditorViewSnapshot) => snapshot.batchMode;
const selectExportSize = (snapshot: EditorViewSnapshot) => snapshot.exportSize;

export function CompletedDocumentConnector() {
  const model = useEditorModel();
  const snapshot = useEditorSessionSelector(selectActiveSnapshot);
  const batchMode = useEditorViewSelector(selectBatchMode);
  const exportSize = useEditorViewSelector(selectExportSize);
  if (snapshot === null) return null;

  const sizes = availableExportSizes({ width: snapshot.width, height: snapshot.height });
  const selectedSize = sizes.includes(exportSize) ? exportSize : "original";
  const singleExport = model.session.singleExportSnapshot();

  return (
    <div className="space-y-4">
      {batchMode ? <BatchRailConnector /> : null}
      <ActiveDocument
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
