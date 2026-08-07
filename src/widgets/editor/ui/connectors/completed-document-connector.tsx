import type { EditorSessionTypes } from "@/editor/runtime";

import {
  useEditorSessionSelector,
  useEditorViewSelector,
  type EditorViewSnapshot,
} from "../../model";
import { ActiveDocument } from "../active-document";
import { BatchRailConnector } from "./batch-connectors";

const selectActiveSnapshot = (
  snapshot: EditorSessionTypes.Snapshot,
): EditorSessionTypes.ActiveSnapshot | null =>
  snapshot.kind === "document" ? snapshot : null;
const selectBatchMode = (snapshot: EditorViewSnapshot) => snapshot.batchMode;

export function CompletedDocumentConnector() {
  const snapshot = useEditorSessionSelector(selectActiveSnapshot);
  const batchMode = useEditorViewSelector(selectBatchMode);
  if (snapshot === null) return null;

  return (
    <div className="space-y-4">
      {batchMode ? <BatchRailConnector /> : null}
      <ActiveDocument key={snapshot.actor.id} actor={snapshot.actor} />
    </div>
  );
}
