import { fromCallback, fromPromise, setup } from "xstate";

import {
  decideDocumentCommand,
  transitionDocument,
  type DocumentEffect,
  type DocumentSnapshot,
  type DocumentState,
  type ProcessingRequest,
} from "@/v2/domain";

import { executeArtifactEffect } from "./artifact-effect-executor";
import type {
  DocumentActorContext,
  DocumentActorEvent,
  DocumentActorInput,
  DocumentMachineDependencies,
} from "./document-machine.types";
import { createProcessingRunActor } from "./processing-run-actor";

type ManualCommitInput = {
  documentId: DocumentState["documentId"];
  draftId: NonNullable<DocumentState["manualDraft"]>["draftId"];
  expectedRevision: number;
  source: DocumentState["source"];
  draftMatte: NonNullable<DocumentState["pendingManualCommit"]>["draftMatte"];
};

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
  };
}

export function createDocumentMachine(dependencies: DocumentMachineDependencies) {
  const machineSetup = setup({
    types: {
      context: {} as DocumentActorContext,
      events: {} as DocumentActorEvent,
      input: {} as DocumentActorInput,
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
    },
  });

  const applyCommand = machineSetup.enqueueActions(({ context, enqueue, event }) => {
    if (event.type !== "COMMAND") {
      return;
    }

    let envelope;
    if (event.command.type === "START_AUTOMATIC_REMOVAL") {
      envelope = { command: event.command, runId: dependencies.runIds.next() } as const;
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

    let promotion: Extract<DocumentEffect, { type: "promote-run" }> | null = null;
    for (const effect of transition.effects) {
      if (effect.type === "promote-run") {
        promotion = effect;
      } else {
        executeArtifactEffect(dependencies, effect);
      }
    }

    if (promotion !== null) {
      const accepted = executeArtifactEffect(dependencies, promotion) === true;
      enqueue.raise({
        type: "DOMAIN_EVENT",
        event: {
          type: accepted ? "COMMIT_ACCEPTED" : "COMMIT_REJECTED_STALE",
          documentId: promotion.documentId,
          runId: promotion.runId,
          expectedRevision: promotion.expectedRevision,
        },
      });
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
        },
      });
    }
  });

  return machineSetup.createMachine({
    id: "editor-v2-document",
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
              documentId: context.document.documentId,
              draftId: pending.draftId,
              expectedRevision: pending.expectedRevision,
              source: context.document.source,
              draftMatte: pending.draftMatte,
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
      disposed: { type: "final" },
    },
  });
}
