import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

import type { EditorSessionTypes } from "@/editor/runtime";

import type { EditorModel, EditorViewSnapshot } from "./editor-model";

export const EditorContext = createContext<EditorModel | null>(null);

export function useEditorModel(): EditorModel {
  const model = useContext(EditorContext);
  if (model === null) throw new Error("Editor components require EditorProvider");
  return model;
}

export function useEditorViewSelector<Value>(
  selector: (snapshot: EditorViewSnapshot) => Value,
): Value {
  const model = useEditorModel();
  const getSnapshot = useCallback(
    () => selector(model.getViewSnapshot()),
    [model, selector],
  );
  return useSyncExternalStore(model.subscribeView, getSnapshot, getSnapshot);
}

export function useEditorSessionSelector<Value>(
  selector: (snapshot: EditorSessionTypes.Snapshot) => Value,
): Value {
  const model = useEditorModel();
  const subscribe = useCallback(
    (listener: () => void) => model.session.subscribeActive(listener),
    [model],
  );
  const getSnapshot = useCallback(
    () => selector(model.session.getSnapshot()),
    [model, selector],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useEditorSessionValue<Value>(
  selector: (session: EditorSessionTypes.Session) => Value,
): Value {
  const model = useEditorModel();
  const subscribe = useCallback(
    (listener: () => void) => model.session.subscribeActive(listener),
    [model],
  );
  const getSnapshot = useCallback(() => selector(model.session), [model, selector]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useEditorWorkspaceSelector<Value>(
  selector: (snapshot: EditorSessionTypes.WorkspaceSnapshot) => Value,
): Value {
  const model = useEditorModel();
  const subscribe = useCallback(
    (listener: () => void) => model.session.subscribe(listener),
    [model],
  );
  const getSnapshot = useCallback(
    () => selector(model.session.workspaceSnapshot()),
    [model, selector],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
