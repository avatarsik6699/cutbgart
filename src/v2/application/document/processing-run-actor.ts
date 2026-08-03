import { fromCallback } from "xstate";

import type { DocumentEffect, ProcessingRequest, RunCorrelation } from "@/v2/domain";

import type {
  DocumentActorEvent,
  DocumentMachineDependencies,
} from "./document-machine.types";

type ProcessingRunActorEvent = { type: "CANCEL" };

function correlationFromRequest(request: ProcessingRequest): RunCorrelation {
  return {
    documentId: request.documentId,
    runId: request.runId,
    expectedRevision: request.expectedRevision,
  };
}

export function createProcessingRunActor(dependencies: DocumentMachineDependencies) {
  return fromCallback<ProcessingRunActorEvent, ProcessingRequest>(
    function processingRunCallback(args) {
      const cancellation = dependencies.cancellation.create();
      const run = dependencies.gateway.start(args.input, cancellation.signal);
      const correlation = correlationFromRequest(args.input);
      const unsubscribe = run.subscribe((progress) => {
        args.sendBack({
          type: "DOMAIN_EVENT",
          event: { type: "PROCESSING_PROGRESS", ...progress },
        } satisfies DocumentActorEvent);
      });

      void run.terminal.then((terminal) => {
        if (terminal.type === "succeeded") {
          args.sendBack({
            type: "DOMAIN_EVENT",
            event: {
              type: "PROCESSING_SUCCEEDED",
              snapshot: terminal.snapshot,
              ...correlation,
            },
          } satisfies DocumentActorEvent);
        } else if (terminal.type === "failed") {
          args.sendBack({
            type: "DOMAIN_EVENT",
            event: { type: "PROCESSING_FAILED", error: terminal.error, ...correlation },
          } satisfies DocumentActorEvent);
        } else {
          args.sendBack({
            type: "DOMAIN_EVENT",
            event: { type: "PROCESSING_CANCELLED", ...correlation },
          } satisfies DocumentActorEvent);
        }
      });

      args.receive((event) => {
        if (event.type === "CANCEL") run.cancel();
      });

      return function releaseProcessingRun() {
        unsubscribe();
        cancellation.abort();
        run.cancel();
        run.release();
        dependencies.artifacts.releaseRun({
          type: "release-run-if-owned",
          documentId: args.input.documentId,
          runId: args.input.runId,
        } satisfies DocumentEffect);
      };
    },
  );
}
