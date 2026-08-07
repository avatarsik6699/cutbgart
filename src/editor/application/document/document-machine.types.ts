import type { ActorRefFrom } from "xstate";

import type {
  CommandOutcome,
  DocumentCommand,
  DocumentTransitionTypes,
  DocumentEvent,
  DocumentState,
  RunId,
  BackgroundDraftId,
  EnhancementDraftId,
  ManualDraftId,
  MagicDraftId,
  EditOperationId,
} from "@/editor/domain";
import type { ProcessingCancellationSource, ProcessingGateway } from "../processing";

export declare namespace DocumentMachineTypes {
  type RunIdSource = { next(): RunId };
  type ManualIdSource = {
    draft(): ManualDraftId;
    operation(): EditOperationId;
  };
  type MagicIdSource = { draft(): MagicDraftId };
  type FinishingIdSource = {
    backgroundDraft(): BackgroundDraftId;
    enhancementDraft(): EnhancementDraftId;
    operation(): EditOperationId;
  };

  type ArtifactEffects = {
    commitAutomaticHistory?(
      effect: Extract<
        DocumentTransitionTypes.Effect,
        { type: "commit-automatic-history" }
      >,
    ): void;
    estimateHistoricalBytes(snapshot: import("@/editor/domain").DocumentSnapshot): number;
    exportPng(
      effect: Extract<DocumentTransitionTypes.Effect, { type: "export-png" }>,
    ): void;
    promoteRun(
      effect: Extract<DocumentTransitionTypes.Effect, { type: "promote-run" }>,
    ): boolean;
    releaseDocument(
      effect: Extract<DocumentTransitionTypes.Effect, { type: "release-document" }>,
    ): void;
    releaseRun(
      effect: Extract<DocumentTransitionTypes.Effect, { type: "release-run-if-owned" }>,
    ): void;
    releaseManualDraft(
      effect: Extract<DocumentTransitionTypes.Effect, { type: "release-manual-draft" }>,
    ): void;
    commitManualHistory(
      effect: Extract<DocumentTransitionTypes.Effect, { type: "commit-manual-history" }>,
    ): void;
    releaseMagicDraft?(
      effect: Extract<DocumentTransitionTypes.Effect, { type: "release-magic-draft" }>,
    ): void;
    commitMagicHistory?(
      effect: Extract<DocumentTransitionTypes.Effect, { type: "commit-magic-history" }>,
    ): void;
    releaseBackgroundDraft?(
      effect: Extract<
        DocumentTransitionTypes.Effect,
        { type: "release-background-draft" }
      >,
    ): void;
    commitBackgroundHistory?(
      effect: Extract<
        DocumentTransitionTypes.Effect,
        { type: "commit-background-history" }
      >,
    ): void;
    releaseEnhancementDraft?(
      effect: Extract<
        DocumentTransitionTypes.Effect,
        { type: "release-enhancement-draft" }
      >,
    ): void;
    commitEnhancementHistory?(
      effect: Extract<
        DocumentTransitionTypes.Effect,
        { type: "commit-enhancement-history" }
      >,
    ): void;
    moveDocumentHistory(
      effect: Extract<DocumentTransitionTypes.Effect, { type: "move-document-history" }>,
    ): void;
  };

  type Dependencies = {
    artifacts: ArtifactEffects;
    cancellation: ProcessingCancellationSource;
    gateway: ProcessingGateway;
    runIds: RunIdSource;
    manualIds: ManualIdSource;
    magicIds?: MagicIdSource;
    finishingIds?: FinishingIdSource;
    manualCommitter: import("./manual-cutout-committer").ManualCutoutCommitter;
    magicPredictor?: import("./magic-cutout-predictor").MagicCutoutPredictor;
    magicCommitter?: import("./magic-cutout-committer").MagicCutoutCommitter;
    backgroundCommitter?: import("./background-committer").BackgroundCommitter;
    enhancementCommitter?: import("./enhancement-committer").EnhancementCommitter;
  };

  type ActorInput = { document: DocumentState };
  type ActorContext = {
    document: DocumentState;
    lastCommandOutcome: CommandOutcome | null;
  };
  type ActorEvent =
    | { type: "COMMAND"; command: DocumentCommand }
    | { type: "DOMAIN_EVENT"; event: DocumentEvent }
    | {
        type: "xstate.done.actor.manual-commit";
        output: import("@/editor/domain").DocumentSnapshot;
      }
    | { type: "xstate.error.actor.manual-commit"; error: unknown };

  type ActorRef = ActorRefFrom<
    ReturnType<typeof import("./document-machine").createDocumentMachine>
  >;
}
