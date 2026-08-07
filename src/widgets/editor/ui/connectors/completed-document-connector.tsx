import {
  selectActiveActor,
  useEditorSessionSelector,
  useEditorViewSelector,
  type EditorViewSnapshot,
} from "../../model";
import { ActiveDocument } from "../active-document";
import { BatchRailConnector } from "./batch-connectors";

const selectBatchMode = (snapshot: EditorViewSnapshot) => snapshot.batchMode;

export function CompletedDocumentConnector() {
  const actor = useEditorSessionSelector(selectActiveActor);
  const batchMode = useEditorViewSelector(selectBatchMode);
  if (actor === null) return null;

  return (
    <div className="space-y-4">
      {batchMode ? <BatchRailConnector /> : null}
      <ActiveDocument key={actor.id} actor={actor} />
    </div>
  );
}
