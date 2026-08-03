import type { DocumentState } from "../document";
import type {
  DocumentCommandEnvelope,
  DocumentDecision,
  DocumentEffect,
} from "./document-transition.types";
import {
  accepted,
  clearRun,
  correlationFor,
  isActiveRunStatus,
  rejectDecision,
} from "./transition-policy";

export function decideDocumentCommand(
  state: DocumentState,
  envelope: DocumentCommandEnvelope,
): DocumentDecision {
  const command = envelope.command;
  if (state.status === "disposed") return rejectDecision(state, command.type, "disposed");
  if (command.documentId !== state.documentId) {
    return rejectDecision(state, command.type, "document-not-found");
  }

  switch (command.type) {
    case "START_AUTOMATIC_REMOVAL": {
      if (!("runId" in envelope)) return rejectDecision(state, command.type, "not-ready");
      if (state.activeRun !== null || isActiveRunStatus(state.status)) {
        return rejectDecision(state, command.type, "run-active");
      }
      if (
        state.status !== "ready" &&
        !(state.status === "error" && state.error?.retryable)
      ) {
        return rejectDecision(state, command.type, "not-ready");
      }
      const correlation = {
        documentId: state.documentId,
        runId: envelope.runId,
        expectedRevision: state.revision,
      };
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeRun: { runId: envelope.runId, expectedRevision: state.revision },
          pendingCommit: null,
          status: "queued",
          stage: "queued",
          progress: null,
          error: null,
        },
        effects: [{ type: "start-processing", source: state.source, ...correlation }],
      };
    }
    case "CANCEL_ACTIVE_RUN": {
      const correlation = correlationFor(state);
      if (
        correlation === null ||
        state.status === "cancelling" ||
        !isActiveRunStatus(state.status) ||
        state.status === "committing"
      ) {
        return rejectDecision(state, command.type, "no-active-run");
      }
      return {
        outcome: accepted(command.type),
        state: { ...state, status: "cancelling", error: null },
        effects: [{ type: "cancel-processing", ...correlation }],
      };
    }
    case "EXPORT_PNG":
      if (state.status !== "result" || state.committed === null) {
        return rejectDecision(state, command.type, "no-result");
      }
      if (command.expectedRevision !== state.revision) {
        return rejectDecision(state, command.type, "stale-revision");
      }
      return {
        outcome: accepted(command.type),
        state,
        effects: [
          {
            type: "export-png",
            documentId: state.documentId,
            artifactId: state.committed.composite,
            revision: state.revision,
          },
        ],
      };
    case "RESET_DOCUMENT": {
      const correlation = correlationFor(state);
      const effects: DocumentEffect[] = [];
      if (correlation !== null) {
        effects.push({ type: "cancel-processing", ...correlation });
        effects.push({
          type: "release-run-if-owned",
          documentId: state.documentId,
          runId: correlation.runId,
        });
      }
      effects.push({ type: "release-document", documentId: state.documentId });
      return {
        outcome: accepted(command.type),
        state: clearRun(state, "disposed", null),
        effects,
      };
    }
  }
}
