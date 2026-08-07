import { useEffect } from "react";

import { useActiveDocumentActorSelector, useActiveDocumentModel } from "../../model";

export function DocumentHistoryShortcuts() {
  const model = useActiveDocumentModel();
  const dirtyDraft = useActiveDocumentActorSelector(
    (snapshot) => snapshot.context.document.activeDraft?.dirty === true,
  );

  useEffect(
    function routeDocumentHistoryShortcutsFx() {
      function keyDownFx(event: KeyboardEvent): void {
        if (dirtyDraft || !(event.ctrlKey || event.metaKey)) return;
        const key = event.key.toLowerCase();
        if (key !== "z" && key !== "y") return;
        event.preventDefault();
        if (key === "y" || event.shiftKey) model.redoDocument();
        else model.undoDocument();
      }
      globalThis.addEventListener("keydown", keyDownFx);
      return function removeDocumentHistoryShortcutsFx() {
        globalThis.removeEventListener("keydown", keyDownFx);
      };
    },
    [dirtyDraft, model],
  );

  return null;
}
