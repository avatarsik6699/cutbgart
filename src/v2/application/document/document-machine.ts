import { fromCallback, setup } from "xstate";

import {
  decideDocumentCommand,
  transitionDocument,
  type DocumentEffect,
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
    },
  });

  const applyCommand = machineSetup.enqueueActions(({ context, enqueue, event }) => {
    if (event.type !== "COMMAND") {
      return;
    }

    const envelope =
      event.command.type === "START_AUTOMATIC_REMOVAL"
        ? { command: event.command, runId: dependencies.runIds.next() }
        : { command: event.command };
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
      disposed: { type: "final" },
    },
  });
}
