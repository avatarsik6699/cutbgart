import { fromCallback, fromPromise, setup } from "xstate";

import {
  decideDocumentCommand,
  transitionDocument,
  type DocumentTransitionTypes,
  type DocumentSnapshot,
  type DocumentState,
  type ProcessingError,
  type ProcessingRequest,
} from "@/editor/domain";

import { executeArtifactEffect } from "./artifact-effect-executor";
import type { DocumentMachineTypes } from "./document-machine.types";
import { createProcessingRunActor } from "./processing-run-actor";
import { ProcessingGatewayError } from "../processing";

type ManualCommitInput = {
  automaticModelMode: DocumentSnapshot["automaticModelMode"];
  documentId: DocumentState["documentId"];
  draftId: Extract<
    NonNullable<DocumentState["activeDraft"]>,
    { kind: "manual-cutout" }
  >["draftId"];
  expectedRevision: number;
  source: DocumentState["source"];
  draftMatte: NonNullable<DocumentState["pendingManualCommit"]>["draftMatte"];
  foreground: DocumentSnapshot["foreground"];
  background: DocumentSnapshot["background"];
};

type MagicPredictionInput = NonNullable<DocumentState["activeMagicPrediction"]>;
type MagicCommitInput = {
  automaticModelMode: DocumentSnapshot["automaticModelMode"];
  documentId: DocumentState["documentId"];
  draftId: NonNullable<DocumentState["pendingMagicCommit"]>["draftId"];
  candidateId: NonNullable<DocumentState["pendingMagicCommit"]>["candidateId"];
  expectedRevision: number;
  draftRevision: number;
  foreground: DocumentSnapshot["foreground"];
  background: DocumentSnapshot["background"];
};
type BackgroundCommitInput = import("./background-committer").BackgroundCommitInput & {
  operationId: import("@/editor/domain").EditOperationId;
};
type BackgroundCommitOutput = {
  input: BackgroundCommitInput;
  snapshot: DocumentSnapshot;
};
type EnhancementCommitInput = import("./enhancement-committer").EnhancementCommitInput & {
  operationId: import("@/editor/domain").EditOperationId;
};
type EnhancementCommitResult = import("./enhancement-committer").EnhancementCommitResult;
type EnhancementCommitOutput = {
  input: EnhancementCommitInput;
  result: EnhancementCommitResult;
};

function invokedProcessingError(error: unknown, fallback: string): ProcessingError {
  if (error instanceof ProcessingGatewayError) return error.detail;
  return {
    code: "processing-failed",
    message: error instanceof Error ? error.message : fallback,
    retryable: true,
  };
}

function processingRequestFromState(state: DocumentState): ProcessingRequest {
  if (state.activeRun === null) {
    throw new Error("A processing child requires an active run");
  }

  return {
    documentId: state.documentId,
    runId: state.activeRun.runId,
    expectedRevision: state.activeRun.expectedRevision,
    operation: "automatic-remove",
    source: state.source,
    modelMode: state.activeRun.modelMode,
  };
}

export function createDocumentMachine(dependencies: DocumentMachineTypes.Dependencies) {
  const machineSetup = setup({
    types: {
      context: {} as DocumentMachineTypes.ActorContext,
      events: {} as DocumentMachineTypes.ActorEvent,
      input: {} as DocumentMachineTypes.ActorInput,
    },
    actors: {
      documentLifetime: fromCallback<
        { type: "NOOP" },
        { documentId: DocumentState["documentId"] }
      >(function documentLifetimeCallback(args) {
        return function releaseDocumentLifetime() {
          dependencies.artifacts.releaseDocument({
            type: "release-document",
            documentId: args.input.documentId,
          });
        };
      }),
      processingRun: createProcessingRunActor(dependencies),
      manualCommit: fromPromise<DocumentSnapshot, ManualCommitInput>(
        async ({ input, signal }) => dependencies.manualCommitter.commit(input, signal),
      ),
      magicPrediction: fromPromise<
        readonly import("@/editor/domain").MagicCutoutTypes.CandidateSummary[],
        MagicPredictionInput
      >(async ({ input, signal }) => {
        if (dependencies.magicPredictor === undefined) {
          throw new Error("Magic prediction is unavailable");
        }
        return dependencies.magicPredictor.predict(input, signal);
      }),
      magicCommit: fromPromise<DocumentSnapshot, MagicCommitInput>(
        async ({ input, signal }) => {
          if (dependencies.magicCommitter === undefined) {
            throw new Error("Magic commit is unavailable");
          }
          return dependencies.magicCommitter.commit(input, signal);
        },
      ),
      backgroundCommit: fromPromise<BackgroundCommitOutput, BackgroundCommitInput>(
        async ({ input, signal }) => {
          if (dependencies.backgroundCommitter === undefined)
            throw new Error("Background commit is unavailable");
          return {
            input,
            snapshot: await dependencies.backgroundCommitter.commit(input, signal),
          };
        },
      ),
      enhancementCommit: fromPromise<EnhancementCommitOutput, EnhancementCommitInput>(
        async ({ input, signal }) => {
          if (dependencies.enhancementCommitter === undefined)
            throw new Error("Enhancements are unavailable");
          return {
            input,
            result: await dependencies.enhancementCommitter.commit(input, signal),
          };
        },
      ),
    },
  });

  const applyCommand = machineSetup.enqueueActions(({ context, enqueue, event }) => {
    if (event.type !== "COMMAND") {
      return;
    }

    let envelope;
    if (event.command.type === "START_AUTOMATIC_REMOVAL") {
      envelope = {
        command: event.command,
        operationId: dependencies.manualIds.operation(),
        runId: dependencies.runIds.next(),
      } as const;
    } else if (event.command.type === "BEGIN_MANUAL_CUTOUT") {
      envelope = {
        command: event.command,
        draftId: dependencies.manualIds.draft(),
      } as const;
    } else if (event.command.type === "APPLY_MANUAL_CUTOUT") {
      envelope = {
        command: event.command,
        operationId: dependencies.manualIds.operation(),
      } as const;
    } else if (event.command.type === "BEGIN_MAGIC_CUTOUT") {
      const draftId = dependencies.magicIds?.draft();
      if (draftId === undefined) {
        throw new Error("Magic draft IDs are unavailable");
      }
      envelope = {
        command: event.command,
        draftId,
      } as const;
    } else if (event.command.type === "APPLY_MAGIC_CUTOUT") {
      envelope = {
        command: event.command,
        operationId: dependencies.manualIds.operation(),
      } as const;
    } else if (event.command.type === "BEGIN_BACKGROUND") {
      const draftId = dependencies.finishingIds?.backgroundDraft();
      if (draftId === undefined) throw new Error("Background draft IDs are unavailable");
      envelope = { command: event.command, draftId } as const;
    } else if (event.command.type === "APPLY_BACKGROUND") {
      const operationId = dependencies.finishingIds?.operation();
      if (operationId === undefined)
        throw new Error("Background operation IDs are unavailable");
      envelope = { command: event.command, operationId } as const;
    } else if (event.command.type === "BEGIN_ENHANCEMENTS") {
      const draftId = dependencies.finishingIds?.enhancementDraft();
      if (draftId === undefined) throw new Error("Enhancement draft IDs are unavailable");
      envelope = { command: event.command, draftId } as const;
    } else if (event.command.type === "APPLY_ENHANCEMENTS") {
      const operationId = dependencies.finishingIds?.operation();
      if (operationId === undefined)
        throw new Error("Enhancement operation IDs are unavailable");
      envelope = { command: event.command, operationId } as const;
    } else {
      envelope = { command: event.command } as const;
    }
    const decision = decideDocumentCommand(context.document, envelope);

    enqueue.assign({
      document: decision.state,
      lastCommandOutcome: decision.outcome,
    });
    for (const effect of decision.effects) {
      if (effect.type === "cancel-processing") {
        enqueue.sendTo("processing-run", { type: "CANCEL" });
      } else {
        executeArtifactEffect(dependencies, effect);
      }
    }
  });

  const applyDomainEvent = machineSetup.enqueueActions(({ context, enqueue, event }) => {
    if (event.type !== "DOMAIN_EVENT") {
      return;
    }

    const transition = transitionDocument(context.document, event.event);
    enqueue.assign({ document: transition.state });

    let promotion: Extract<
      DocumentTransitionTypes.Effect,
      { type: "promote-run" }
    > | null = null;
    for (const effect of transition.effects) {
      if (effect.type === "promote-run") {
        promotion = effect;
      } else {
        executeArtifactEffect(dependencies, effect);
      }
    }

    if (promotion !== null) {
      const accepted = executeArtifactEffect(dependencies, promotion) === true;
      if (accepted) {
        enqueue.raise({
          type: "DOMAIN_EVENT",
          event: {
            type: "COMMIT_ACCEPTED",
            documentId: promotion.documentId,
            runId: promotion.runId,
            expectedRevision: promotion.expectedRevision,
            estimatedHistoricalBytes:
              context.document.committed === null
                ? 0
                : dependencies.artifacts.estimateHistoricalBytes(
                    context.document.committed,
                  ),
          },
        });
      } else {
        enqueue.raise({
          type: "DOMAIN_EVENT",
          event: {
            type: "COMMIT_REJECTED_STALE",
            documentId: promotion.documentId,
            runId: promotion.runId,
            expectedRevision: promotion.expectedRevision,
          },
        });
      }
    }

    if (
      transition.outcome === "applied" &&
      event.event.type === "PREPARATION_SUCCEEDED" &&
      transition.state.status === "ready"
    ) {
      enqueue.raise({
        type: "COMMAND",
        command: {
          type: "START_AUTOMATIC_REMOVAL",
          documentId: transition.state.documentId,
          backend: "local",
          modelMode: event.event.modelMode,
        },
      });
    }
  });

  return machineSetup.createMachine({
    id: "editor-document",
    initial: "active",
    context: ({ input }) => ({ document: input.document, lastCommandOutcome: null }),
    invoke: {
      id: "document-lifetime",
      src: "documentLifetime",
      input: ({ context }) => ({ documentId: context.document.documentId }),
    },
    states: {
      active: {
        always: [
          {
            guard: ({ context }) => context.document.status === "disposed",
            target: "disposed",
          },
          {
            guard: ({ context }) => context.document.activeRun !== null,
            target: "running",
          },
          {
            guard: ({ context }) => context.document.pendingManualCommit !== null,
            target: "manualApplying",
          },
          {
            guard: ({ context }) => context.document.activeMagicPrediction !== null,
            target: "magicPredicting",
          },
          {
            guard: ({ context }) => context.document.pendingMagicCommit !== null,
            target: "magicApplying",
          },
          {
            guard: ({ context }) => context.document.pendingBackgroundCommit !== null,
            target: "backgroundApplying",
          },
          {
            guard: ({ context }) => context.document.pendingEnhancementCommit !== null,
            target: "enhancementApplying",
          },
        ],
        on: {
          COMMAND: { actions: applyCommand },
          DOMAIN_EVENT: { actions: applyDomainEvent },
        },
      },
      running: {
        invoke: {
          id: "processing-run",
          src: "processingRun",
          input: ({ context }) => processingRequestFromState(context.document),
        },
        always: [
          {
            guard: ({ context }) => context.document.status === "disposed",
            target: "disposed",
          },
          {
            guard: ({ context }) => context.document.status === "committing",
            target: "committing",
          },
          {
            guard: ({ context }) => context.document.activeRun === null,
            target: "active",
          },
        ],
        on: {
          COMMAND: { actions: applyCommand },
          DOMAIN_EVENT: { actions: applyDomainEvent },
        },
      },
      committing: {
        always: [
          {
            guard: ({ context }) => context.document.status === "disposed",
            target: "disposed",
          },
          {
            guard: ({ context }) => context.document.status !== "committing",
            target: "active",
          },
        ],
        on: {
          COMMAND: { actions: applyCommand },
          DOMAIN_EVENT: { actions: applyDomainEvent },
        },
      },
      manualApplying: {
        invoke: {
          id: "manual-commit",
          src: "manualCommit",
          input: ({ context }) => {
            const pending = context.document.pendingManualCommit;
            if (pending === null) throw new Error("Manual commit input is unavailable");
            return {
              automaticModelMode:
                context.document.committed?.automaticModelMode ?? "isnet-q8",
              documentId: context.document.documentId,
              draftId: pending.draftId,
              expectedRevision: pending.expectedRevision,
              source: context.document.source,
              draftMatte: pending.draftMatte,
              foreground: context.document.committed?.foreground ?? null,
              background: context.document.committed?.background ?? {
                type: "transparent",
              },
            };
          },
          onDone: {
            target: "manualSettling",
            actions: ({ context, event, self }) => {
              const pending = context.document.pendingManualCommit;
              if (pending === null) return;
              self.send({
                type: "DOMAIN_EVENT",
                event: {
                  type: "MANUAL_COMMIT_SUCCEEDED",
                  documentId: context.document.documentId,
                  draftId: pending.draftId,
                  expectedRevision: pending.expectedRevision,
                  snapshot: event.output,
                  estimatedHistoricalBytes:
                    context.document.committed === null
                      ? 0
                      : dependencies.artifacts.estimateHistoricalBytes(
                          context.document.committed,
                        ),
                },
              });
            },
          },
          onError: {
            target: "manualSettling",
            actions: ({ context, event, self }) => {
              const pending = context.document.pendingManualCommit;
              if (pending === null) return;
              self.send({
                type: "DOMAIN_EVENT",
                event: {
                  type: "MANUAL_COMMIT_FAILED",
                  documentId: context.document.documentId,
                  draftId: pending.draftId,
                  expectedRevision: pending.expectedRevision,
                  error: {
                    code: "processing-failed",
                    message:
                      event.error instanceof Error
                        ? event.error.message
                        : "Manual cutout could not be applied",
                    retryable: true,
                  },
                },
              });
            },
          },
        },
        on: {
          COMMAND: { actions: applyCommand },
          DOMAIN_EVENT: { actions: applyDomainEvent },
        },
      },
      manualSettling: {
        on: {
          DOMAIN_EVENT: { target: "active", actions: applyDomainEvent },
          COMMAND: { actions: applyCommand },
        },
      },
      magicPredicting: {
        entry: ({ context, self }) => {
          const prediction = context.document.activeMagicPrediction;
          if (prediction === null) return;
          self.send({
            type: "DOMAIN_EVENT",
            event: { type: "MAGIC_PREDICTION_STARTED", ...prediction },
          });
        },
        invoke: {
          id: "magic-prediction",
          src: "magicPrediction",
          input: ({ context }) => {
            const prediction = context.document.activeMagicPrediction;
            if (prediction === null)
              throw new Error("Magic prediction input is unavailable");
            return prediction;
          },
          onDone: {
            target: "magicPredictionSettling",
            actions: ({ context, event, self }) => {
              const prediction = context.document.activeMagicPrediction;
              if (prediction === null) return;
              self.send({
                type: "DOMAIN_EVENT",
                event: {
                  type: "MAGIC_PREVIEW_READY",
                  ...prediction,
                  candidates: event.output,
                },
              });
            },
          },
          onError: {
            target: "magicPredictionSettling",
            actions: ({ context, event, self }) => {
              const prediction = context.document.activeMagicPrediction;
              if (prediction === null) return;
              self.send({
                type: "DOMAIN_EVENT",
                event: {
                  type: "MAGIC_PREDICTION_FAILED",
                  ...prediction,
                  error: invokedProcessingError(event.error, "Magic prediction failed"),
                },
              });
            },
          },
        },
        always: [
          {
            guard: ({ context }) => context.document.status === "disposed",
            target: "disposed",
          },
          {
            guard: ({ context }) => context.document.activeMagicPrediction === null,
            target: "active",
          },
        ],
        on: {
          COMMAND: { actions: applyCommand },
          DOMAIN_EVENT: { actions: applyDomainEvent },
        },
      },
      magicPredictionSettling: {
        on: {
          DOMAIN_EVENT: { target: "active", actions: applyDomainEvent },
          COMMAND: { actions: applyCommand },
        },
      },
      magicApplying: {
        invoke: {
          id: "magic-commit",
          src: "magicCommit",
          input: ({ context }) => {
            const pending = context.document.pendingMagicCommit;
            if (pending === null) throw new Error("Magic commit input is unavailable");
            return {
              automaticModelMode:
                context.document.committed?.automaticModelMode ?? "isnet-q8",
              documentId: context.document.documentId,
              draftId: pending.draftId,
              candidateId: pending.candidateId,
              expectedRevision: pending.expectedRevision,
              draftRevision: pending.draftRevision,
              foreground: context.document.committed?.foreground ?? null,
              background: context.document.committed?.background ?? {
                type: "transparent",
              },
            };
          },
          onDone: {
            target: "magicCommitSettling",
            actions: ({ context, event, self }) => {
              const pending = context.document.pendingMagicCommit;
              if (pending === null) return;
              self.send({
                type: "DOMAIN_EVENT",
                event: {
                  type: "MAGIC_COMMIT_SUCCEEDED",
                  documentId: context.document.documentId,
                  draftId: pending.draftId,
                  expectedRevision: pending.expectedRevision,
                  draftRevision: pending.draftRevision,
                  snapshot: event.output,
                  estimatedHistoricalBytes:
                    context.document.committed === null
                      ? 0
                      : dependencies.artifacts.estimateHistoricalBytes(
                          context.document.committed,
                        ),
                },
              });
            },
          },
          onError: {
            target: "magicCommitSettling",
            actions: ({ context, event, self }) => {
              const pending = context.document.pendingMagicCommit;
              if (pending === null) return;
              self.send({
                type: "DOMAIN_EVENT",
                event: {
                  type: "MAGIC_COMMIT_FAILED",
                  documentId: context.document.documentId,
                  draftId: pending.draftId,
                  expectedRevision: pending.expectedRevision,
                  draftRevision: pending.draftRevision,
                  error: invokedProcessingError(event.error, "Magic apply failed"),
                },
              });
            },
          },
        },
        always: [
          {
            guard: ({ context }) => context.document.status === "disposed",
            target: "disposed",
          },
          {
            guard: ({ context }) => context.document.pendingMagicCommit === null,
            target: "active",
          },
        ],
        on: {
          COMMAND: { actions: applyCommand },
          DOMAIN_EVENT: { actions: applyDomainEvent },
        },
      },
      magicCommitSettling: {
        on: {
          DOMAIN_EVENT: { target: "active", actions: applyDomainEvent },
          COMMAND: { actions: applyCommand },
        },
      },
      backgroundApplying: {
        invoke: {
          id: "background-commit",
          src: "backgroundCommit",
          input: ({ context }) => {
            const pending = context.document.pendingBackgroundCommit;
            const draft = context.document.activeDraft;
            const snapshot = context.document.committed;
            if (pending === null || draft?.kind !== "background" || snapshot === null)
              throw new Error("Background commit input is unavailable");
            return {
              documentId: context.document.documentId,
              draftId: pending.draftId,
              expectedRevision: pending.expectedRevision,
              draftRevision: pending.draftRevision,
              source: context.document.source,
              snapshot,
              fill: draft.fill,
              operationId: pending.operationId,
            };
          },
          onDone: {
            target: "backgroundCommitSettling",
            actions: ({ context, event, self }) => {
              const invocation = event.output.input;
              self.send({
                type: "DOMAIN_EVENT",
                event: {
                  type: "BACKGROUND_COMMIT_SUCCEEDED",
                  documentId: invocation.documentId,
                  draftId: invocation.draftId,
                  expectedRevision: invocation.expectedRevision,
                  draftRevision: invocation.draftRevision,
                  snapshot: event.output.snapshot,
                  estimatedHistoricalBytes:
                    context.document.committed === null
                      ? 0
                      : dependencies.artifacts.estimateHistoricalBytes(
                          context.document.committed,
                        ),
                },
              });
            },
          },
          onError: {
            target: "backgroundCommitSettling",
            actions: ({ context, event, self }) => {
              const pending = context.document.pendingBackgroundCommit;
              if (pending === null) return;
              self.send({
                type: "DOMAIN_EVENT",
                event: {
                  type: "BACKGROUND_COMMIT_FAILED",
                  documentId: context.document.documentId,
                  draftId: pending.draftId,
                  expectedRevision: pending.expectedRevision,
                  draftRevision: pending.draftRevision,
                  error: invokedProcessingError(event.error, "Background apply failed"),
                },
              });
            },
          },
        },
        always: [
          {
            guard: ({ context }) => context.document.pendingBackgroundCommit === null,
            target: "active",
          },
        ],
        on: {
          COMMAND: { actions: applyCommand },
          DOMAIN_EVENT: { actions: applyDomainEvent },
        },
      },
      backgroundCommitSettling: {
        on: {
          DOMAIN_EVENT: { target: "active", actions: applyDomainEvent },
          COMMAND: { actions: applyCommand },
        },
      },
      enhancementApplying: {
        entry: ({ context, self }) => {
          const pending = context.document.pendingEnhancementCommit;
          const draft = context.document.activeDraft;
          if (pending === null || draft?.kind !== "enhance") return;
          self.send({
            type: "DOMAIN_EVENT",
            event: {
              type: "ENHANCEMENT_STARTED",
              documentId: context.document.documentId,
              draftId: pending.draftId,
              runId: pending.runId,
              expectedRevision: pending.expectedRevision,
              operationIds: draft.selectedOperationIds,
            },
          });
        },
        invoke: {
          id: "enhancement-commit",
          src: "enhancementCommit",
          input: ({ context }) => {
            const pending = context.document.pendingEnhancementCommit;
            const draft = context.document.activeDraft;
            const snapshot = context.document.committed;
            if (pending === null || draft?.kind !== "enhance" || snapshot === null)
              throw new Error("Enhancement input is unavailable");
            return {
              documentId: context.document.documentId,
              draftId: pending.draftId,
              runId: pending.runId,
              expectedRevision: pending.expectedRevision,
              source: context.document.source,
              snapshot,
              operationIds: draft.selectedOperationIds,
              operationId: pending.operationId,
            };
          },
          onDone: {
            target: "enhancementCommitSettling",
            actions: ({ context, event, self }) => {
              const invocation = event.output.input;
              if (event.output.result.outcome === "unchanged") {
                self.send({
                  type: "DOMAIN_EVENT",
                  event: {
                    type: "ENHANCEMENT_UNCHANGED",
                    documentId: invocation.documentId,
                    draftId: invocation.draftId,
                    runId: invocation.runId,
                    expectedRevision: invocation.expectedRevision,
                  },
                });
                return;
              }
              self.send({
                type: "DOMAIN_EVENT",
                event: {
                  type: "ENHANCEMENT_COMMIT_SUCCEEDED",
                  documentId: invocation.documentId,
                  draftId: invocation.draftId,
                  runId: invocation.runId,
                  expectedRevision: invocation.expectedRevision,
                  snapshot: event.output.result.snapshot,
                  estimatedHistoricalBytes:
                    context.document.committed === null
                      ? 0
                      : dependencies.artifacts.estimateHistoricalBytes(
                          context.document.committed,
                        ),
                },
              });
            },
          },
          onError: {
            target: "enhancementCommitSettling",
            actions: ({ context, event, self }) => {
              const pending = context.document.pendingEnhancementCommit;
              if (pending === null) return;
              self.send({
                type: "DOMAIN_EVENT",
                event: {
                  type: "ENHANCEMENT_FAILED",
                  documentId: context.document.documentId,
                  draftId: pending.draftId,
                  runId: pending.runId,
                  expectedRevision: pending.expectedRevision,
                  error: invokedProcessingError(event.error, "Enhancements failed"),
                },
              });
            },
          },
        },
        always: [
          {
            guard: ({ context }) => context.document.pendingEnhancementCommit === null,
            target: "active",
          },
        ],
        on: {
          COMMAND: { actions: applyCommand },
          DOMAIN_EVENT: { actions: applyDomainEvent },
        },
      },
      enhancementCommitSettling: {
        on: {
          DOMAIN_EVENT: { target: "active", actions: applyDomainEvent },
          COMMAND: { actions: applyCommand },
        },
      },
      disposed: { type: "final" },
    },
  });
}
