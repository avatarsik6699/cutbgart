import type { DocumentId, EnhancementDraftId, Revision } from "../ids";

export declare namespace EnhancementTypes {
  type OperationId = "fine-detail" | "colour-halo";
  type ExecutionAdapter = "matte-refinement" | "foreground-cleanup";
  type OperationDefinition = Readonly<{
    id: OperationId;
    order: 10 | 20;
    executionAdapter: ExecutionAdapter;
    selectedByDefault: true;
  }>;
  type DraftStatus = "ready" | "queued" | "running" | "applying" | "error";

  type Draft = {
    kind: "enhance";
    draftId: EnhancementDraftId;
    documentId: DocumentId;
    baselineRevision: Revision;
    selectedOperationIds: readonly OperationId[];
    dirty: boolean;
    status: DraftStatus;
  };
}
