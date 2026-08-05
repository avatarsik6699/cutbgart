import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  createEditorSession,
  type EditorSession,
  type EditorSessionOptions,
} from "@/v2/runtime-browser";

export function useEditorSession(
  options?: EditorSessionOptions,
  observeWorkspace = false,
) {
  const [session] = useState<EditorSession>(() => createEditorSession(options));
  const subscribe = useCallback(
    (listener: () => void) =>
      observeWorkspace ? session.subscribe(listener) : session.subscribeActive(listener),
    [observeWorkspace, session],
  );
  const getSnapshot = useCallback(() => session.getSnapshot(), [session]);
  const getServerSnapshot = useCallback(() => session.getSnapshot(), [session]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(
    function disposeEditorSessionFx() {
      return () => {
        void session.dispose();
      };
    },
    [session],
  );

  return { session, snapshot, workspace: session.workspaceSnapshot() };
}
