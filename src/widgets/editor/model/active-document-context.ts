import { useSelector } from "@xstate/react";
import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

import type { DocumentMachineTypes } from "@/editor/application";

import {
  ActiveDocumentModel,
  type ActiveDocumentViewSnapshot,
} from "./active-document-model";

export const ActiveDocumentContext = createContext<ActiveDocumentModel | null>(null);

export function useActiveDocumentModel(): ActiveDocumentModel {
  const model = useContext(ActiveDocumentContext);
  if (model === null)
    throw new Error("Active document components require ActiveDocumentProvider");
  return model;
}

export function useActiveDocumentActorSelector<Value>(
  selector: (snapshot: ReturnType<DocumentMachineTypes.ActorRef["getSnapshot"]>) => Value,
): Value {
  const model = useActiveDocumentModel();
  return useSelector(model.actor, selector);
}

export function useActiveDocumentViewSelector<Value>(
  selector: (snapshot: ActiveDocumentViewSnapshot) => Value,
): Value {
  const model = useActiveDocumentModel();
  const getSnapshot = useCallback(
    () => selector(model.viewStore.getSnapshot()),
    [model, selector],
  );
  const subscribe = useCallback(
    (listener: () => void) => model.viewStore.subscribe(listener),
    [model],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
