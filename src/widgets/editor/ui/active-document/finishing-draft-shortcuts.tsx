import { useEffect } from "react";

import { selectBackgroundDraft, selectEnhancementDraft } from "@/editor/application";
import type { BackgroundTypes, EnhancementTypes } from "@/editor/domain";
import type { EditorSessionTypes } from "@/editor/runtime";

import {
  selectActiveBackgroundRuntime,
  useActiveDocumentActorSelector,
  useActiveDocumentModel,
  useEditorSessionValue,
} from "../../model";

const selectBackgroundRuntimeStatus = (session: EditorSessionTypes.Session): string =>
  selectActiveBackgroundRuntime(session)?.status ?? "idle";

function cancelFinishingDraft(
  session: EditorSessionTypes.Session,
  backgroundDraft: BackgroundTypes.Draft | null,
  enhancementDraft: EnhancementTypes.Draft | null,
): boolean {
  if (backgroundDraft !== null) session.cancelBackground();
  else if (enhancementDraft !== null) session.cancelEnhancements();
  else return false;
  return true;
}

function applyFinishingDraft(
  session: EditorSessionTypes.Session,
  backgroundDraft: BackgroundTypes.Draft | null,
  enhancementDraft: EnhancementTypes.Draft | null,
  backgroundRuntimeStatus: string,
): boolean {
  if (
    backgroundDraft?.dirty === true &&
    backgroundDraft.status !== "applying" &&
    backgroundRuntimeStatus === "ready"
  ) {
    session.applyBackground();
    return true;
  }
  if (
    enhancementDraft !== null &&
    enhancementDraft.selectedOperationIds.length > 0 &&
    !["queued", "running", "applying"].includes(enhancementDraft.status)
  ) {
    session.applyEnhancements();
    return true;
  }
  return false;
}

export function FinishingDraftShortcuts() {
  const model = useActiveDocumentModel();
  const backgroundDraft = useActiveDocumentActorSelector(selectBackgroundDraft);
  const enhancementDraft = useActiveDocumentActorSelector(selectEnhancementDraft);
  const backgroundRuntimeStatus = useEditorSessionValue(selectBackgroundRuntimeStatus);

  useEffect(
    function routeFinishingDraftGuardsFx() {
      function beforeUnloadFx(event: BeforeUnloadEvent): void {
        if (backgroundDraft?.dirty !== true && enhancementDraft?.dirty !== true) return;
        event.preventDefault();
        event.returnValue = "";
      }
      function keyDownFx(event: KeyboardEvent): void {
        if (event.key === "Escape") {
          if (
            cancelFinishingDraft(model.editor.session, backgroundDraft, enhancementDraft)
          )
            event.preventDefault();
          return;
        }
        if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
        if (
          applyFinishingDraft(
            model.editor.session,
            backgroundDraft,
            enhancementDraft,
            backgroundRuntimeStatus,
          )
        )
          event.preventDefault();
      }
      globalThis.addEventListener("beforeunload", beforeUnloadFx);
      globalThis.addEventListener("keydown", keyDownFx);
      return function removeFinishingDraftGuardsFx() {
        globalThis.removeEventListener("beforeunload", beforeUnloadFx);
        globalThis.removeEventListener("keydown", keyDownFx);
      };
    },
    [backgroundDraft, backgroundRuntimeStatus, enhancementDraft, model],
  );

  return null;
}
