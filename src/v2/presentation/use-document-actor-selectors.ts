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
  type DocumentActorRef,
} from "@/v2/application";

export function useDocumentActorSelectors(actor: DocumentActorRef) {
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
  };
}
