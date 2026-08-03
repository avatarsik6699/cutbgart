import type { DocumentId, EnhancementDraftId, Revision } from "../ids";

export type EnhancementOperationId = "fine-detail" | "colour-halo";
export type EnhancementExecutionAdapter = "matte-refinement" | "foreground-cleanup";
export type EnhancementOperationDefinition = Readonly<{
  id: EnhancementOperationId;
  order: 10 | 20;
  executionAdapter: EnhancementExecutionAdapter;
  selectedByDefault: true;
}>;
export type EnhancementDraftStatus =
  "ready" | "queued" | "running" | "applying" | "error";

export type EnhancementDraft = {
  kind: "enhance";
  draftId: EnhancementDraftId;
  documentId: DocumentId;
  baselineRevision: Revision;
  selectedOperationIds: readonly EnhancementOperationId[];
  dirty: boolean;
  status: EnhancementDraftStatus;
};
