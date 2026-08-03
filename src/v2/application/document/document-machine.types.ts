import type { ActorRefFrom } from "xstate";

import type {
  CommandOutcome,
  DocumentCommand,
  DocumentEffect,
  DocumentEvent,
  DocumentState,
  RunId,
  ManualDraftId,
  MagicDraftId,
  EditOperationId,
} from "@/v2/domain";
import type { ProcessingCancellationSource, ProcessingGateway } from "../processing";

export type DocumentRunIdSource = { next(): RunId };
export type DocumentManualIdSource = {
  draft(): ManualDraftId;
  operation(): EditOperationId;
};
export type DocumentMagicIdSource = { draft(): MagicDraftId };

export type DocumentArtifactEffects = {
  estimateHistoricalBytes(snapshot: import("@/v2/domain").DocumentSnapshot): number;
  exportPng(effect: Extract<DocumentEffect, { type: "export-png" }>): void;
  promoteRun(effect: Extract<DocumentEffect, { type: "promote-run" }>): boolean;
  releaseDocument(effect: Extract<DocumentEffect, { type: "release-document" }>): void;
  releaseRun(effect: Extract<DocumentEffect, { type: "release-run-if-owned" }>): void;
  releaseManualDraft(
    effect: Extract<DocumentEffect, { type: "release-manual-draft" }>,
  ): void;
  commitManualHistory(
    effect: Extract<DocumentEffect, { type: "commit-manual-history" }>,
  ): void;
  releaseMagicDraft?(
    effect: Extract<DocumentEffect, { type: "release-magic-draft" }>,
  ): void;
  commitMagicHistory?(
    effect: Extract<DocumentEffect, { type: "commit-magic-history" }>,
  ): void;
  moveDocumentHistory(
    effect: Extract<DocumentEffect, { type: "move-document-history" }>,
  ): void;
};

export type DocumentMachineDependencies = {
  artifacts: DocumentArtifactEffects;
  cancellation: ProcessingCancellationSource;
  gateway: ProcessingGateway;
  runIds: DocumentRunIdSource;
  manualIds: DocumentManualIdSource;
  magicIds?: DocumentMagicIdSource;
  manualCommitter: import("./manual-cutout-committer").ManualCutoutCommitter;
  magicPredictor?: import("./magic-cutout-predictor").MagicCutoutPredictor;
  magicCommitter?: import("./magic-cutout-committer").MagicCutoutCommitter;
};

export type DocumentActorInput = { document: DocumentState };
export type DocumentActorContext = {
  document: DocumentState;
  lastCommandOutcome: CommandOutcome | null;
};
export type DocumentActorEvent =
  | { type: "COMMAND"; command: DocumentCommand }
  | { type: "DOMAIN_EVENT"; event: DocumentEvent }
  | {
      type: "xstate.done.actor.manual-commit";
      output: import("@/v2/domain").DocumentSnapshot;
    }
  | { type: "xstate.error.actor.manual-commit"; error: unknown };

export type DocumentActorRef = ActorRefFrom<
  ReturnType<typeof import("./document-machine").createDocumentMachine>
>;
