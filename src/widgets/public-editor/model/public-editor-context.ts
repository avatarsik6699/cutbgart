import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

import type { EditorSessionTypes } from "@/v2/runtime-browser";

import type { PublicEditorModel, PublicEditorViewSnapshot } from "./public-editor-model";

export const PublicEditorModelContext = createContext<PublicEditorModel | null>(null);

export function usePublicEditorModel(): PublicEditorModel {
  const model = useContext(PublicEditorModelContext);
  if (model === null)
    throw new Error("Public editor components require PublicEditorModelProvider");
  return model;
}

export function usePublicEditorViewSelector<Value>(
  selector: (snapshot: PublicEditorViewSnapshot) => Value,
): Value {
  const model = usePublicEditorModel();
  const getSnapshot = useCallback(
    () => selector(model.getViewSnapshot()),
    [model, selector],
  );
  return useSyncExternalStore(model.subscribeView, getSnapshot, getSnapshot);
}

export function useEditorSessionSelector<Value>(
  selector: (snapshot: EditorSessionTypes.Snapshot) => Value,
): Value {
  const model = usePublicEditorModel();
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
  const model = usePublicEditorModel();
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
  const model = usePublicEditorModel();
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
