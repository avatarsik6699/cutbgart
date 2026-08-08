import { useMemo } from "react";

import { selectEnhancementDraft } from "@/editor/application";

import {
  selectActiveEnhancementRuntime,
  selectActiveHeight,
  selectActiveOriginalUrl,
  selectActiveResultUrl,
  selectActiveWidth,
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
  const height = useEditorSessionValue(selectActiveHeight);
  const originalUrl = useEditorSessionValue(selectActiveOriginalUrl);
  const resultUrl = useEditorSessionValue(selectActiveResultUrl);
  const runtime = useEditorSessionValue(selectActiveEnhancementRuntime);
  const width = useEditorSessionValue(selectActiveWidth);
  const interaction = useMemo<EnhancementInteraction>(() => {
    const session = model.editor.session;
    return {
      apply: () => session.applyEnhancements(),
      cancel: () => session.cancelEnhancements(),
      change: (operationIds) => session.changeEnhancements(operationIds),
      retry: () => session.retryEnhancements(),
    };
  }, [model]);

  if (draft === null || originalUrl === null || resultUrl === null || runtime === null)
    return null;
  return (
    <EnhancementWorkspace
      draft={draft}
      height={height}
      previewUrl={resultUrl}
      runtime={runtime}
      sourceUrl={originalUrl}
      interaction={interaction}
      width={width}
    />
  );
}
