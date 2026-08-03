import { useSelector } from "@xstate/react";

import {
  selectDocumentError,
  selectDocumentProgress,
  selectDocumentStatus,
  selectLastDocumentCommandOutcome,
  type DocumentActorRef,
} from "@/v2/application";

export function useDocumentActorSelectors(actor: DocumentActorRef) {
  const status = useSelector(actor, selectDocumentStatus);
  const progress = useSelector(actor, selectDocumentProgress);
  const error = useSelector(actor, selectDocumentError);
  const lastCommandOutcome = useSelector(actor, selectLastDocumentCommandOutcome);

  return { status, progress, error, lastCommandOutcome };
}
