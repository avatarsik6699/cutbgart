import { useCallback } from "react";

import {
  selectHasFutureDocumentHistory,
  selectHasPastDocumentHistory,
} from "@/editor/application";
import { m } from "@/paraglide/messages";

import {
  useActiveDocumentActorSelector,
  useActiveDocumentModel,
  useEditorSessionValue,
} from "../../model";

function selectDraftHistoryFlags(
  session: ReturnType<typeof useActiveDocumentModel>["editor"]["session"],
): number {
  const manual = session.manualDraft();
  const magic = session.magicDraft()?.snapshot() ?? null;
  return (
    Number(manual?.canUndo === true || magic?.canUndo === true) |
    (Number(manual?.canRedo === true || magic?.canRedo === true) << 1)
  );
}

export function useToolbarHistory() {
  const document = useActiveDocumentModel();
  const hasPastDocumentHistory = useActiveDocumentActorSelector(
    selectHasPastDocumentHistory,
  );
  const hasFutureDocumentHistory = useActiveDocumentActorSelector(
    selectHasFutureDocumentHistory,
  );
  const dirtyDraft = useActiveDocumentActorSelector(
    (snapshot) => snapshot.context.document.activeDraft?.dirty === true,
  );
  const draftHistoryFlags = useEditorSessionValue(selectDraftHistoryFlags);
  const canUndoDraft = (draftHistoryFlags & 1) !== 0;
  const canRedoDraft = (draftHistoryFlags & 2) !== 0;
  const undo = useCallback(
    () => (canUndoDraft ? document.undoDraft() : document.undoDocument()),
    [canUndoDraft, document],
  );
  const redo = useCallback(
    () => (canRedoDraft ? document.redoDraft() : document.redoDocument()),
    [canRedoDraft, document],
  );

  return {
    canRedo: canRedoDraft || (!dirtyDraft && hasFutureDocumentHistory),
    canUndo: canUndoDraft || (!dirtyDraft && hasPastDocumentHistory),
    redo,
    redoLabel: canRedoDraft ? m.editorDraftRedo() : null,
    undo,
    undoLabel: canUndoDraft ? m.editorDraftUndo() : null,
  } as const;
}
