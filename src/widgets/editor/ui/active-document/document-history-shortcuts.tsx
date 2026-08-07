import { useEffect } from "react";

import { useToolbarHistory } from "./use-toolbar-history";

export function DocumentHistoryShortcuts() {
  const { canRedo, canUndo, redo, undo } = useToolbarHistory();

  useEffect(
    function routeDocumentHistoryShortcutsFx() {
      function keyDownFx(event: KeyboardEvent): void {
        if (!(event.ctrlKey || event.metaKey)) return;
        const key = event.key.toLowerCase();
        if (key !== "z" && key !== "y") return;
        const isRedo = key === "y" || event.shiftKey;
        if (isRedo ? !canRedo : !canUndo) return;
        event.preventDefault();
        if (isRedo) redo();
        else undo();
      }
      globalThis.addEventListener("keydown", keyDownFx);
      return function removeDocumentHistoryShortcutsFx() {
        globalThis.removeEventListener("keydown", keyDownFx);
      };
    },
    [canRedo, canUndo, redo, undo],
  );

  return null;
}
