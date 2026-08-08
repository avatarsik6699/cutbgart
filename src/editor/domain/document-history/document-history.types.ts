import type { DocumentSnapshot } from "../artifacts";
import type { DocumentId, EditOperationId, ManualDraftId, Revision } from "../ids";

export declare namespace DocumentHistoryTypes {
  type ManualMode = "restore" | "erase";

  type ManualDraft = {
    kind: "manual-cutout";
    draftId: ManualDraftId;
    documentId: DocumentId;
    baselineRevision: Revision;
    dirty: boolean;
  };

  type Entry = {
    operationId: EditOperationId;
    kind:
      "automatic-remove" | "manual-cutout" | "magic-cutout" | "background" | "enhance";
    before: DocumentSnapshot;
    after: DocumentSnapshot;
    estimatedHistoricalBytes: number;
  };

  type State = {
    past: readonly Entry[];
    future: readonly Entry[];
    retainedHistoricalBytes: number;
  };

  type Change = {
    history: State;
    released: readonly Entry[];
  };

  type Move = Change & {
    entry: Entry | null;
    snapshot: DocumentSnapshot | null;
  };
}
