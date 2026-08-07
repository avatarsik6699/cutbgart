import { fromCallback } from "xstate";

import type {
  DocumentTransitionTypes,
  ProcessingRequest,
  RunCorrelation,
} from "@/v2/domain";

import type { DocumentMachineTypes } from "./document-machine.types";

type ProcessingRunActorEvent = { type: "CANCEL" };

function correlationFromRequest(request: ProcessingRequest): RunCorrelation {
  return {
    documentId: request.documentId,
    runId: request.runId,
    expectedRevision: request.expectedRevision,
  };
}

export function createProcessingRunActor(
  dependencies: DocumentMachineTypes.Dependencies,
) {
  return fromCallback<ProcessingRunActorEvent, ProcessingRequest>(
    function processingRunCallback(args) {
      const cancellation = dependencies.cancellation.create();
      const run = dependencies.gateway.start(args.input, cancellation.signal);
      const correlation = correlationFromRequest(args.input);
      const unsubscribe = run.subscribe((progress) => {
        args.sendBack({
          type: "DOMAIN_EVENT",
          event: { type: "PROCESSING_PROGRESS", ...progress },
        } satisfies DocumentMachineTypes.ActorEvent);
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
          } satisfies DocumentMachineTypes.ActorEvent);
        } else if (terminal.type === "failed") {
          args.sendBack({
            type: "DOMAIN_EVENT",
            event: { type: "PROCESSING_FAILED", error: terminal.error, ...correlation },
          } satisfies DocumentMachineTypes.ActorEvent);
        } else {
          args.sendBack({
            type: "DOMAIN_EVENT",
            event: { type: "PROCESSING_CANCELLED", ...correlation },
          } satisfies DocumentMachineTypes.ActorEvent);
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
        } satisfies DocumentTransitionTypes.Effect);
      };
    },
  );
}
