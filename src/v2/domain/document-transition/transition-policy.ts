import type { CommandOutcome, DocumentCommand } from "../commands";
import type { DocumentState } from "../document";
import type { ProcessingLifecycleEvent } from "../events";
import type { ProcessingError, ProcessingStage, RunCorrelation } from "../processing";
import type { DocumentDecision, DocumentTransition } from "./document-transition.types";

const ACTIVE_RUN_STATUSES = [
  "queued",
  "model-loading",
  "processing",
  "cancelling",
  "committing",
] as const satisfies readonly DocumentState["status"][];

export function accepted(command: DocumentCommand["type"]): CommandOutcome {
  return { status: "accepted", command };
}

export function rejectDecision(
  state: DocumentState,
  command: DocumentCommand["type"],
  reason: Extract<CommandOutcome, { status: "rejected" }>["reason"],
): DocumentDecision {
  return { outcome: { status: "rejected", command, reason }, state, effects: [] };
}

export function correlationFor(state: DocumentState): RunCorrelation | null {
  if (state.activeRun === null) return null;
  return {
    documentId: state.documentId,
    runId: state.activeRun.runId,
    expectedRevision: state.activeRun.expectedRevision,
  };
}

export function matchesCorrelation(state: DocumentState, event: RunCorrelation): boolean {
  const active = state.activeRun;
  return (
    active !== null &&
    event.documentId === state.documentId &&
    event.runId === active.runId &&
    event.expectedRevision === active.expectedRevision &&
    event.expectedRevision === state.revision
  );
}

export function stageStatus(stage: ProcessingStage): DocumentState["status"] {
  if (stage === "queued") return "queued";
  if (stage === "model-loading") return "model-loading";
  return "processing";
}

export function isActiveRunStatus(
  status: DocumentState["status"],
): status is (typeof ACTIVE_RUN_STATUSES)[number] {
  return ACTIVE_RUN_STATUSES.some((candidate) => candidate === status);
}

export function stableStatus(state: DocumentState): DocumentState["status"] {
  return state.committed === null ? "ready" : "result";
}

export function clearRun(
  state: DocumentState,
  status: DocumentState["status"],
  error: ProcessingError | null,
): DocumentState {
  return {
    ...state,
    activeRun: null,
    pendingCommit: null,
    status,
    stage: null,
    progress: null,
    error,
  };
}

export function staleTerminalTransition(
  state: DocumentState,
  event: ProcessingLifecycleEvent,
): DocumentTransition {
  if (
    event.type === "PROCESSING_SUCCEEDED" ||
    event.type === "PROCESSING_FAILED" ||
    event.type === "PROCESSING_CANCELLED"
  ) {
    return {
      outcome: "ignored-stale",
      state,
      effects: [
        {
          type: "release-run-if-owned",
          documentId: event.documentId,
          runId: event.runId,
        },
      ],
    };
  }
  return { outcome: "ignored-stale", state, effects: [] };
}
