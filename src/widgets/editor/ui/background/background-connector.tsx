import { useMemo } from "react";

import { selectBackgroundDraft } from "@/editor/application";

import {
  selectActiveBackgroundRuntime,
  selectActiveForegroundUrl,
  selectActiveHeight,
  selectActiveResultUrl,
  selectActiveWidth,
  useActiveDocumentActorSelector,
  useActiveDocumentModel,
  useEditorSessionValue,
} from "../../model";
import { BackgroundWorkspace, type BackgroundInteraction } from "./background-workspace";

export function BackgroundConnector() {
  const model = useActiveDocumentModel();
  const draft = useActiveDocumentActorSelector(selectBackgroundDraft);
  const foregroundUrl = useEditorSessionValue(selectActiveForegroundUrl);
  const height = useEditorSessionValue(selectActiveHeight);
  const resultUrl = useEditorSessionValue(selectActiveResultUrl);
  const runtime = useEditorSessionValue(selectActiveBackgroundRuntime);
  const width = useEditorSessionValue(selectActiveWidth);
  const interaction = useMemo<BackgroundInteraction>(() => {
    const session = model.editor.session;
    return {
      apply: () => session.applyBackground(),
      cancel: () => session.cancelBackground(),
      change: (fill) => session.changeBackground(fill),
      selectImage: (file) => void session.selectBackgroundImage(file),
    };
  }, [model]);

  if (draft === null || foregroundUrl === null || resultUrl === null || runtime === null)
    return null;
  return (
    <BackgroundWorkspace
      draft={draft}
      foregroundUrl={foregroundUrl}
      height={height}
      runtime={runtime}
      sourceUrl={resultUrl}
      interaction={interaction}
      width={width}
    />
  );
}
