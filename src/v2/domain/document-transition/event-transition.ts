import type { DocumentEvent } from "../events";
import type { DocumentState } from "../document";
import type { DocumentTransition } from "./document-transition.types";
import {
  clearRun,
  isActiveRunStatus,
  matchesCorrelation,
  stableStatus,
  stageStatus,
  staleTerminalTransition,
} from "./transition-policy";
import { commitDocumentHistory } from "../document-history";
import { matchesMagicPrediction } from "../magic-cutout";

export function transitionDocument(
  state: DocumentState,
  event: DocumentEvent,
): DocumentTransition {
  if (event.documentId !== state.documentId || state.status === "disposed") {
    return { outcome: "ignored-stale", state, effects: [] };
  }

  switch (event.type) {
    case "BACKGROUND_COMMIT_SUCCEEDED": {
      const draft = state.activeDraft;
      const pending = state.pendingBackgroundCommit;
      if (
        state.status !== "background-applying" ||
        state.committed === null ||
        draft?.kind !== "background" ||
        draft.draftId !== event.draftId ||
        pending?.draftId !== event.draftId ||
        pending.draftRevision !== event.draftRevision ||
        event.expectedRevision !== state.revision
      ) {
        return {
          outcome: "ignored-stale",
          state,
          effects: [
            {
              type: "release-background-draft",
              documentId: event.documentId,
              draftId: event.draftId,
            },
          ],
        };
      }
      const entry = {
        operationId: pending.operationId,
        kind: "background" as const,
        before: state.committed,
        after: event.snapshot,
        estimatedHistoricalBytes: event.estimatedHistoricalBytes,
      };
      const committedHistory = commitDocumentHistory(state.history, entry);
      return {
        outcome: "applied",
        state: {
          ...state,
          committed: event.snapshot,
          history: committedHistory.history,
          activeDraft: null,
          pendingBackgroundCommit: null,
          revision: state.revision + 1,
          status: "result",
          error: null,
        },
        effects: [
          {
            type: "commit-background-history",
            documentId: state.documentId,
            draftId: event.draftId,
            entry,
            released: committedHistory.released,
          },
        ],
      };
    }
    case "BACKGROUND_COMMIT_FAILED": {
      const draft = state.activeDraft;
      const pending = state.pendingBackgroundCommit;
      if (
        draft?.kind !== "background" ||
        pending?.draftId !== event.draftId ||
        pending.draftRevision !== event.draftRevision ||
        event.expectedRevision !== state.revision
      )
        return { outcome: "ignored-stale", state, effects: [] };
      return {
        outcome: "applied",
        state: {
          ...state,
          activeDraft: { ...draft, status: "error" },
          pendingBackgroundCommit: null,
          status: "result",
          error: event.error,
        },
        effects: [],
      };
    }
    case "ENHANCEMENT_STARTED": {
      const draft = state.activeDraft;
      const pending = state.pendingEnhancementCommit;
      if (
        draft?.kind !== "enhance" ||
        pending?.draftId !== event.draftId ||
        pending.runId !== event.runId ||
        event.expectedRevision !== state.revision
      )
        return { outcome: "ignored-stale", state, effects: [] };
      return {
        outcome: "applied",
        state: {
          ...state,
          activeDraft: { ...draft, status: "running" },
          status: "enhancement-running",
        },
        effects: [],
      };
    }
    case "ENHANCEMENT_COMMIT_SUCCEEDED": {
      const draft = state.activeDraft;
      const pending = state.pendingEnhancementCommit;
      if (
        state.committed === null ||
        draft?.kind !== "enhance" ||
        pending?.draftId !== event.draftId ||
        pending.runId !== event.runId ||
        event.expectedRevision !== state.revision
      ) {
        return {
          outcome: "ignored-stale",
          state,
          effects: [
            {
              type: "release-enhancement-draft",
              documentId: event.documentId,
              draftId: event.draftId,
            },
          ],
        };
      }
      const entry = {
        operationId: pending.operationId,
        kind: "enhance" as const,
        before: state.committed,
        after: event.snapshot,
        estimatedHistoricalBytes: event.estimatedHistoricalBytes,
      };
      const committedHistory = commitDocumentHistory(state.history, entry);
      return {
        outcome: "applied",
        state: {
          ...state,
          committed: event.snapshot,
          history: committedHistory.history,
          activeDraft: null,
          pendingEnhancementCommit: null,
          revision: state.revision + 1,
          status: "result",
          error: null,
        },
        effects: [
          {
            type: "commit-enhancement-history",
            documentId: state.documentId,
            draftId: event.draftId,
            entry,
            released: committedHistory.released,
          },
        ],
      };
    }
    case "ENHANCEMENT_UNCHANGED": {
      const draft = state.activeDraft;
      const pending = state.pendingEnhancementCommit;
      if (
        draft?.kind !== "enhance" ||
        pending?.draftId !== event.draftId ||
        pending.runId !== event.runId ||
        event.expectedRevision !== state.revision
      )
        return { outcome: "ignored-stale", state, effects: [] };
      return {
        outcome: "applied",
        state: {
          ...state,
          activeDraft: { ...draft, status: "ready" },
          pendingEnhancementCommit: null,
          status: "result",
          error: null,
        },
        effects: [],
      };
    }
    case "ENHANCEMENT_FAILED": {
      const draft = state.activeDraft;
      const pending = state.pendingEnhancementCommit;
      if (
        draft?.kind !== "enhance" ||
        pending?.draftId !== event.draftId ||
        pending.runId !== event.runId ||
        event.expectedRevision !== state.revision
      )
        return { outcome: "ignored-stale", state, effects: [] };
      return {
        outcome: "applied",
        state: {
          ...state,
          activeDraft: { ...draft, status: "error" },
          pendingEnhancementCommit: null,
          status: "result",
          error: event.error,
        },
        effects: [],
      };
    }
    case "ENHANCEMENT_CANCELLED":
      return { outcome: "ignored-stale", state, effects: [] };
    case "MAGIC_PREDICTION_STARTED": {
      const draft = state.activeDraft;
      if (
        draft?.kind !== "magic-cutout" ||
        state.activeMagicPrediction?.runId !== event.runId ||
        !matchesMagicPrediction(draft, state.revision, event)
      ) {
        return { outcome: "ignored-stale", state, effects: [] };
      }
      return {
        outcome: "applied",
        state: {
          ...state,
          activeDraft: { ...draft, status: "predicting" },
          status: "magic-predicting",
        },
        effects: [],
      };
    }
    case "MAGIC_PREVIEW_READY": {
      const draft = state.activeDraft;
      if (
        draft?.kind !== "magic-cutout" ||
        state.activeMagicPrediction?.runId !== event.runId ||
        !matchesMagicPrediction(draft, state.revision, event)
      ) {
        return { outcome: "ignored-stale", state, effects: [] };
      }
      return {
        outcome: "applied",
        state: {
          ...state,
          activeDraft: { ...draft, status: "preview", selectedCandidateId: null },
          activeMagicPrediction: null,
          magicCandidates: event.candidates,
          status: "result",
          error: null,
        },
        effects: [],
      };
    }
    case "MAGIC_PREDICTION_FAILED": {
      const draft = state.activeDraft;
      if (
        draft?.kind !== "magic-cutout" ||
        state.activeMagicPrediction?.runId !== event.runId ||
        !matchesMagicPrediction(draft, state.revision, event)
      ) {
        return { outcome: "ignored-stale", state, effects: [] };
      }
      return {
        outcome: "applied",
        state: {
          ...state,
          activeDraft: { ...draft, status: "error" },
          activeMagicPrediction: null,
          status: "result",
          error: event.error,
        },
        effects: [],
      };
    }
    case "MAGIC_COMMIT_SUCCEEDED": {
      const draft = state.activeDraft;
      const pending = state.pendingMagicCommit;
      if (
        state.status !== "magic-applying" ||
        draft?.kind !== "magic-cutout" ||
        draft.draftId !== event.draftId ||
        pending?.draftId !== event.draftId ||
        pending.draftRevision !== event.draftRevision ||
        event.expectedRevision !== state.revision ||
        state.committed === null
      ) {
        return { outcome: "ignored-stale", state, effects: [] };
      }
      const entry = {
        operationId: pending.operationId,
        kind: "magic-cutout" as const,
        before: state.committed,
        after: event.snapshot,
        estimatedHistoricalBytes: event.estimatedHistoricalBytes,
      };
      const committedHistory = commitDocumentHistory(state.history, entry);
      return {
        outcome: "applied",
        state: {
          ...state,
          committed: event.snapshot,
          history: committedHistory.history,
          activeDraft: null,
          activeMagicPrediction: null,
          pendingMagicCommit: null,
          magicCandidates: [],
          revision: state.revision + 1,
          status: "result",
          error: null,
        },
        effects: [
          {
            type: "commit-magic-history",
            documentId: state.documentId,
            draftId: event.draftId,
            entry,
            released: committedHistory.released,
          },
        ],
      };
    }
    case "MAGIC_COMMIT_FAILED": {
      const draft = state.activeDraft;
      if (
        draft?.kind !== "magic-cutout" ||
        state.pendingMagicCommit?.draftId !== event.draftId ||
        state.pendingMagicCommit.draftRevision !== event.draftRevision ||
        event.expectedRevision !== state.revision
      ) {
        return { outcome: "ignored-stale", state, effects: [] };
      }
      return {
        outcome: "applied",
        state: {
          ...state,
          activeDraft: { ...draft, status: "error" },
          pendingMagicCommit: null,
          status: "result",
          error: event.error,
        },
        effects: [],
      };
    }
    case "MANUAL_DRAFT_DIRTY_CHANGED": {
      if (
        state.activeDraft?.kind !== "manual-cutout" ||
        state.activeDraft.draftId !== event.draftId ||
        state.status === "manual-applying"
      ) {
        return { outcome: "ignored-stale", state, effects: [] };
      }
      return {
        outcome: "applied",
        state: { ...state, activeDraft: { ...state.activeDraft, dirty: event.dirty } },
        effects: [],
      };
    }
    case "MANUAL_COMMIT_SUCCEEDED": {
      const pending = state.pendingManualCommit;
      if (
        state.status !== "manual-applying" ||
        state.activeDraft?.kind !== "manual-cutout" ||
        state.activeDraft.draftId !== event.draftId ||
        pending?.draftId !== event.draftId ||
        event.expectedRevision !== state.revision ||
        state.committed === null
      ) {
        return {
          outcome: "ignored-stale",
          state,
          effects: [
            {
              type: "release-manual-draft",
              documentId: event.documentId,
              draftId: event.draftId,
            },
          ],
        };
      }
      const entry = {
        operationId: pending.operationId,
        kind: "manual-cutout" as const,
        before: state.committed,
        after: event.snapshot,
        estimatedHistoricalBytes: event.estimatedHistoricalBytes,
      };
      const committedHistory = commitDocumentHistory(state.history, entry);
      return {
        outcome: "applied",
        state: {
          ...state,
          committed: event.snapshot,
          history: committedHistory.history,
          activeDraft: null,
          pendingManualCommit: null,
          revision: state.revision + 1,
          status: "result",
          error: null,
        },
        effects: [
          {
            type: "commit-manual-history",
            documentId: state.documentId,
            draftId: event.draftId,
            entry,
            released: committedHistory.released,
          },
        ],
      };
    }
    case "MANUAL_COMMIT_FAILED": {
      if (
        state.pendingManualCommit?.draftId !== event.draftId ||
        event.expectedRevision !== state.revision
      ) {
        return { outcome: "ignored-stale", state, effects: [] };
      }
      return {
        outcome: "applied",
        state: {
          ...state,
          pendingManualCommit: null,
          status: "result",
          error: event.error,
        },
        effects: [],
      };
    }
    case "PREPARATION_STARTED":
      return state.status === "preparing"
        ? { outcome: "applied", state, effects: [] }
        : { outcome: "rejected", state, effects: [], reason: "illegal-transition" };
    case "PREPARATION_SUCCEEDED":
      return state.status === "preparing"
        ? {
            outcome: "applied",
            state: {
              ...state,
              status: "ready",
              stage: null,
              progress: null,
              error: null,
            },
            effects: [],
          }
        : { outcome: "rejected", state, effects: [], reason: "illegal-transition" };
    case "PREPARATION_FAILED":
      return state.status === "preparing"
        ? {
            outcome: "applied",
            state: { ...state, status: "error", error: event.error },
            effects: [],
          }
        : { outcome: "rejected", state, effects: [], reason: "illegal-transition" };
    case "PROCESSING_QUEUED":
    case "PROCESSING_STARTED":
    case "PROCESSING_PROGRESS":
    case "PROCESSING_CANCEL_REQUESTED":
    case "PROCESSING_SUCCEEDED":
    case "PROCESSING_FAILED":
    case "PROCESSING_CANCELLED": {
      if (!matchesCorrelation(state, event)) {
        return staleTerminalTransition(state, event);
      }
      if (state.status === "cancelling" && event.type !== "PROCESSING_CANCELLED") {
        return staleTerminalTransition(state, event);
      }

      if (event.type === "PROCESSING_QUEUED") {
        return state.status === "queued"
          ? { outcome: "applied", state, effects: [] }
          : { outcome: "rejected", state, effects: [], reason: "illegal-transition" };
      }
      if (event.type === "PROCESSING_STARTED") {
        return state.status === "queued"
          ? {
              outcome: "applied",
              state: {
                ...state,
                status: "processing",
                stage: "automatic-remove",
                progress: null,
              },
              effects: [],
            }
          : { outcome: "rejected", state, effects: [], reason: "illegal-transition" };
      }
      if (event.type === "PROCESSING_PROGRESS") {
        if (!isActiveRunStatus(state.status) || state.status === "committing") {
          return {
            outcome: "rejected",
            state,
            effects: [],
            reason: "illegal-transition",
          };
        }
        return {
          outcome: "applied",
          state: {
            ...state,
            status: stageStatus(event.stage),
            stage: event.stage,
            progress: event.fraction,
          },
          effects: [],
        };
      }
      if (event.type === "PROCESSING_CANCEL_REQUESTED") {
        return state.status === "cancelling"
          ? { outcome: "applied", state, effects: [] }
          : { outcome: "rejected", state, effects: [], reason: "illegal-transition" };
      }
      if (event.type === "PROCESSING_SUCCEEDED") {
        return {
          outcome: "applied",
          state: {
            ...state,
            status: "committing",
            stage: null,
            progress: null,
            pendingCommit: {
              runId: event.runId,
              expectedRevision: event.expectedRevision,
              modelMode: state.activeRun?.modelMode ?? "isnet-q8",
              snapshot: event.snapshot,
            },
          },
          effects: [
            {
              type: "promote-run",
              documentId: event.documentId,
              runId: event.runId,
              expectedRevision: event.expectedRevision,
              snapshot: event.snapshot,
            },
          ],
        };
      }
      if (event.type === "PROCESSING_FAILED") {
        return {
          outcome: "applied",
          state: clearRun(state, "error", event.error),
          effects: [
            {
              type: "release-run-if-owned",
              documentId: state.documentId,
              runId: event.runId,
            },
          ],
        };
      }

      return {
        outcome: "applied",
        state: clearRun(state, stableStatus(state), null),
        effects: [
          {
            type: "release-run-if-owned",
            documentId: state.documentId,
            runId: event.runId,
          },
        ],
      };
    }
    case "COMMIT_ACCEPTED": {
      if (
        state.status !== "committing" ||
        state.pendingCommit === null ||
        !matchesCorrelation(state, event) ||
        state.pendingCommit.runId !== event.runId
      ) {
        return { outcome: "ignored-stale", state, effects: [] };
      }
      if (state.revision === Number.MAX_SAFE_INTEGER) {
        return { outcome: "rejected", state, effects: [], reason: "illegal-transition" };
      }

      const snapshot = state.pendingCommit.snapshot;
      return {
        outcome: "applied",
        state: {
          ...clearRun(state, "result", null),
          committed: snapshot,
          baseline: state.baseline ?? snapshot,
          revision: state.revision + 1,
        },
        effects: [],
      };
    }
    case "COMMIT_REJECTED_STALE": {
      if (!matchesCorrelation(state, event)) {
        return { outcome: "ignored-stale", state, effects: [] };
      }
      return {
        outcome: "applied",
        state: clearRun(state, stableStatus(state), null),
        effects: [
          {
            type: "release-run-if-owned",
            documentId: state.documentId,
            runId: event.runId,
          },
        ],
      };
    }
    case "SOURCE_REGISTERED":
    case "EXPORT_REQUESTED":
    case "EXPORT_SUCCEEDED":
    case "EXPORT_FAILED":
    case "DOCUMENT_RESET":
    case "DOCUMENT_DISPOSED":
      return { outcome: "rejected", state, effects: [], reason: "illegal-transition" };
  }
}
