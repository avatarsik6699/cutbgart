import { selectDocumentStatus } from "@/editor/application";

import {
  selectAvailableModelModes,
  selectCurrentModelMode,
  selectInferencePath,
  selectProcessingModelMode,
  useActiveDocumentActorSelector,
  useActiveDocumentModel,
  useEditorSessionValue,
  useEditorViewSelector,
  type EditorViewSnapshot,
} from "../../model";
import { AutomaticModelControl } from "../editor-tools";

const BUSY_STATUSES = new Set([
  "manual-applying",
  "magic-predicting",
  "magic-applying",
  "background-applying",
  "enhancement-queued",
  "enhancement-running",
  "enhancement-applying",
]);
const selectBatchMode = (snapshot: EditorViewSnapshot) => snapshot.batchMode;
const selectRestoreModelFocus = (snapshot: EditorViewSnapshot) =>
  snapshot.restoreModelFocus;

export function ToolbarRuntimeStatus() {
  const status = useActiveDocumentActorSelector(selectDocumentStatus);
  const document = useActiveDocumentModel();
  const batchMode = useEditorViewSelector(selectBatchMode);
  const restoreFocus = useEditorViewSelector(selectRestoreModelFocus);
  const availableModes = useEditorSessionValue(selectAvailableModelModes);
  const currentMode = useEditorSessionValue(selectCurrentModelMode);
  const processingMode = useEditorSessionValue(selectProcessingModelMode);
  const inferencePath = useEditorSessionValue(selectInferencePath);
  if (batchMode) return null;
  return (
    <AutomaticModelControl
      availableModes={availableModes}
      busy={BUSY_STATUSES.has(status)}
      currentMode={currentMode}
      inferencePath={inferencePath}
      processingMode={processingMode}
      restoreFocus={restoreFocus}
      onFocusRestored={document.editor.markModelFocusRestored}
      onSelect={(mode) => document.requestModel(mode)}
    />
  );
}
