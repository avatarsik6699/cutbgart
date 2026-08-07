import { useSelector } from "@xstate/react";

import {
  selectDocumentError,
  selectDocumentProgress,
  selectDocumentStatus,
  selectLastDocumentCommandOutcome,
  selectManualDraft,
  selectMagicCandidates,
  selectMagicDraft,
  selectCanUndoDocument,
  selectCanRedoDocument,
  selectDocumentRevision,
  selectHasFutureDocumentHistory,
  selectHasPastDocumentHistory,
  selectBackgroundDraft,
  selectEnhancementDraft,
  type DocumentMachineTypes,
} from "@/editor/application";

export function useDocumentActorSelectors(actor: DocumentMachineTypes.ActorRef) {
  const status = useSelector(actor, selectDocumentStatus);
  const progress = useSelector(actor, selectDocumentProgress);
  const error = useSelector(actor, selectDocumentError);
  const lastCommandOutcome = useSelector(actor, selectLastDocumentCommandOutcome);
  const manualDraft = useSelector(actor, selectManualDraft);
  const magicDraft = useSelector(actor, selectMagicDraft);
  const magicCandidates = useSelector(actor, selectMagicCandidates);
  const canUndoDocument = useSelector(actor, selectCanUndoDocument);
  const canRedoDocument = useSelector(actor, selectCanRedoDocument);
  const revision = useSelector(actor, selectDocumentRevision);
  const backgroundDraft = useSelector(actor, selectBackgroundDraft);
  const enhancementDraft = useSelector(actor, selectEnhancementDraft);
  const hasPastDocumentHistory = useSelector(actor, selectHasPastDocumentHistory);
  const hasFutureDocumentHistory = useSelector(actor, selectHasFutureDocumentHistory);

  return {
    status,
    progress,
    error,
    lastCommandOutcome,
    manualDraft,
    magicDraft,
    magicCandidates,
    canUndoDocument,
    canRedoDocument,
    revision,
    backgroundDraft,
    enhancementDraft,
    hasPastDocumentHistory,
    hasFutureDocumentHistory,
  };
}
