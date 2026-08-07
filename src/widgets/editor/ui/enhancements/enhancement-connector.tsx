import { useMemo } from "react";

import { selectEnhancementDraft } from "@/editor/application";

import {
  useActiveDocumentActorSelector,
  useActiveDocumentModel,
  useEditorSessionValue,
} from "../../model";
import {
  EnhancementWorkspace,
  type EnhancementInteraction,
} from "./enhancement-workspace";

export function EnhancementConnector() {
  const model = useActiveDocumentModel();
  const draft = useActiveDocumentActorSelector(selectEnhancementDraft);
  const snapshot = useEditorSessionValue((session) => {
    const current = session.getSnapshot();
    return current.kind === "document" ? current : null;
  });
  const interaction = useMemo<EnhancementInteraction>(() => {
    const session = model.editor.session;
    return {
      apply: () => session.applyEnhancements(),
      cancel: () => session.cancelEnhancements(),
      change: (operationIds) => session.changeEnhancements(operationIds),
      retry: () => session.retryEnhancements(),
    };
  }, [model]);

  if (
    draft === null ||
    snapshot === null ||
    snapshot.previewUrl === null ||
    snapshot.resultUrl === null
  )
    return null;
  return (
    <EnhancementWorkspace
      draft={draft}
      height={snapshot.height}
      previewUrl={snapshot.resultUrl}
      runtime={snapshot.enhancementRuntime}
      sourceUrl={snapshot.previewUrl}
      interaction={interaction}
      width={snapshot.width}
    />
  );
}
