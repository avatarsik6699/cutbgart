import { useSelector } from "@xstate/react";

import {
  selectDocumentError,
  selectDocumentProgress,
  selectDocumentStatus,
  selectLastDocumentCommandOutcome,
  selectManualDraft,
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
  const canUndoDocument = useSelector(actor, selectCanUndoDocument);
  const canRedoDocument = useSelector(actor, selectCanRedoDocument);
  const revision = useSelector(actor, selectDocumentRevision);

  return {
    status,
    progress,
    error,
    lastCommandOutcome,
    manualDraft,
    canUndoDocument,
    canRedoDocument,
    revision,
  };
}
