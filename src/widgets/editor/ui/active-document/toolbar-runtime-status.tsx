import { selectDocumentStatus } from "@/editor/application";

import { useActiveDocumentActorSelector, useEditorSessionValue } from "../../model";
import { LocalExecutionReadout } from "../editor-tools";

const BUSY_STATUSES = new Set([
  "manual-applying",
  "magic-predicting",
  "magic-applying",
  "background-applying",
  "enhancement-queued",
  "enhancement-running",
  "enhancement-applying",
]);

export function ToolbarRuntimeStatus() {
  const status = useActiveDocumentActorSelector(selectDocumentStatus);
  const inferencePath = useEditorSessionValue(
    (session) => session.processingSelection()?.inferencePath ?? "wasm",
  );
  return (
    <LocalExecutionReadout
      busy={BUSY_STATUSES.has(status)}
      inferencePath={inferencePath}
    />
  );
}
