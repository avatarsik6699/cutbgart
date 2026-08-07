import { useMemo } from "react";

import { selectBackgroundDraft } from "@/editor/application";

import {
  useActiveDocumentActorSelector,
  useActiveDocumentModel,
  useEditorSessionValue,
} from "../../model";
import { BackgroundWorkspace, type BackgroundInteraction } from "./background-workspace";

export function BackgroundConnector() {
  const model = useActiveDocumentModel();
  const draft = useActiveDocumentActorSelector(selectBackgroundDraft);
  const snapshot = useEditorSessionValue((session) => {
    const current = session.getSnapshot();
    return current.kind === "document" ? current : null;
  });
  const interaction = useMemo<BackgroundInteraction>(() => {
    const session = model.editor.session;
    return {
      apply: () => session.applyBackground(),
      cancel: () => session.cancelBackground(),
      change: (fill) => session.changeBackground(fill),
      selectImage: (file) => void session.selectBackgroundImage(file),
    };
  }, [model]);

  if (draft === null || snapshot === null || snapshot.foregroundUrl === null) return null;
  return (
    <BackgroundWorkspace
      draft={draft}
      foregroundUrl={snapshot.foregroundUrl}
      height={snapshot.height}
      runtime={snapshot.backgroundRuntime}
      sourceUrl={snapshot.previewUrl ?? snapshot.resultUrl ?? ""}
      interaction={interaction}
      width={snapshot.width}
    />
  );
}
