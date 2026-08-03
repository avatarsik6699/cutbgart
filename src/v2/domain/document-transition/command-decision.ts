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
import { redoDocumentHistory, undoDocumentHistory } from "../document-history";
import { createMagicCutoutDraft } from "../magic-cutout";
import {
  changeBackgroundDraft,
  normalizeBackgroundFill,
  sameBackgroundFill,
} from "../background";
import { changeEnhancementDraft, ENHANCEMENT_OPERATION_ORDER } from "../enhancements";

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
    case "BEGIN_BACKGROUND": {
      if (envelope.command.type !== "BEGIN_BACKGROUND")
        return rejectDecision(state, command.type, "not-ready");
      if (state.status !== "result" || state.committed === null)
        return rejectDecision(state, command.type, "no-result");
      if (state.activeDraft !== null)
        return rejectDecision(state, command.type, "draft-active");
      if (command.expectedRevision !== state.revision)
        return rejectDecision(state, command.type, "stale-revision");
      const draftId = (
        envelope as Extract<
          DocumentCommandEnvelope,
          { command: { type: "BEGIN_BACKGROUND" } }
        >
      ).draftId;
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: {
            kind: "background",
            draftId,
            documentId: state.documentId,
            baselineRevision: state.revision,
            draftRevision: 0,
            fill: state.committed.background,
            dirty: false,
            status: "ready",
          },
          error: null,
        },
        effects: [],
      };
    }
    case "CHANGE_BACKGROUND": {
      const draft = state.activeDraft;
      if (draft?.kind !== "background" || draft.draftId !== command.draftId)
        return rejectDecision(state, command.type, "no-draft");
      if (state.pendingBackgroundCommit !== null || draft.status === "applying")
        return rejectDecision(state, command.type, "operation-active");
      if (
        command.expectedRevision !== state.revision ||
        draft.baselineRevision !== state.revision
      )
        return rejectDecision(state, command.type, "stale-revision");
      if (command.draftRevision !== draft.draftRevision + 1)
        return rejectDecision(state, command.type, "draft-revision-stale");
      const fill = normalizeBackgroundFill(command.fill);
      if (fill === null) return rejectDecision(state, command.type, "invalid-background");
      const changed = changeBackgroundDraft(draft, fill);
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: {
            ...changed,
            dirty:
              state.committed === null ||
              !sameBackgroundFill(state.committed.background, changed.fill),
          },
          error: null,
        },
        effects: [],
      };
    }
    case "APPLY_BACKGROUND": {
      const draft = state.activeDraft;
      if (
        !("operationId" in envelope) ||
        draft?.kind !== "background" ||
        draft.draftId !== command.draftId
      )
        return rejectDecision(state, command.type, "no-draft");
      if (state.pendingBackgroundCommit !== null || draft.status === "applying")
        return rejectDecision(state, command.type, "operation-active");
      if (
        command.expectedRevision !== state.revision ||
        draft.baselineRevision !== state.revision
      )
        return rejectDecision(state, command.type, "stale-revision");
      if (command.draftRevision !== draft.draftRevision)
        return rejectDecision(state, command.type, "draft-revision-stale");
      if (!draft.dirty) return rejectDecision(state, command.type, "draft-not-dirty");
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: { ...draft, status: "applying" },
          pendingBackgroundCommit: {
            draftId: draft.draftId,
            expectedRevision: command.expectedRevision,
            draftRevision: command.draftRevision,
            operationId: envelope.operationId,
          },
          status: "background-applying",
          error: null,
        },
        effects: [],
      };
    }
    case "CANCEL_BACKGROUND": {
      const draft = state.activeDraft;
      if (draft?.kind !== "background" || draft.draftId !== command.draftId)
        return rejectDecision(state, command.type, "no-draft");
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: null,
          pendingBackgroundCommit: null,
          status: "result",
          error: null,
        },
        effects: [
          {
            type: "release-background-draft",
            documentId: state.documentId,
            draftId: draft.draftId,
          },
        ],
      };
    }
    case "BEGIN_ENHANCEMENTS": {
      if (envelope.command.type !== "BEGIN_ENHANCEMENTS")
        return rejectDecision(state, command.type, "not-ready");
      if (state.status !== "result" || state.committed === null)
        return rejectDecision(state, command.type, "no-result");
      if (state.activeDraft !== null)
        return rejectDecision(state, command.type, "draft-active");
      if (command.expectedRevision !== state.revision)
        return rejectDecision(state, command.type, "stale-revision");
      const draftId = (
        envelope as Extract<
          DocumentCommandEnvelope,
          { command: { type: "BEGIN_ENHANCEMENTS" } }
        >
      ).draftId;
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: {
            kind: "enhance",
            draftId,
            documentId: state.documentId,
            baselineRevision: state.revision,
            selectedOperationIds: ENHANCEMENT_OPERATION_ORDER,
            dirty: false,
            status: "ready",
          },
          error: null,
        },
        effects: [],
      };
    }
    case "CHANGE_ENHANCEMENTS": {
      const draft = state.activeDraft;
      if (draft?.kind !== "enhance" || draft.draftId !== command.draftId)
        return rejectDecision(state, command.type, "no-draft");
      if (state.pendingEnhancementCommit !== null)
        return rejectDecision(state, command.type, "operation-active");
      if (
        command.expectedRevision !== state.revision ||
        draft.baselineRevision !== state.revision
      )
        return rejectDecision(state, command.type, "stale-revision");
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: changeEnhancementDraft(draft, command.operationIds),
          error: null,
        },
        effects: [],
      };
    }
    case "APPLY_ENHANCEMENTS": {
      const draft = state.activeDraft;
      if (
        !("operationId" in envelope) ||
        draft?.kind !== "enhance" ||
        draft.draftId !== command.draftId
      )
        return rejectDecision(state, command.type, "no-draft");
      if (state.pendingEnhancementCommit !== null)
        return rejectDecision(state, command.type, "operation-active");
      if (
        command.expectedRevision !== state.revision ||
        draft.baselineRevision !== state.revision
      )
        return rejectDecision(state, command.type, "stale-revision");
      if (draft.selectedOperationIds.length === 0)
        return rejectDecision(state, command.type, "no-operations");
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: { ...draft, status: "queued" },
          pendingEnhancementCommit: {
            draftId: draft.draftId,
            runId: command.runId,
            expectedRevision: command.expectedRevision,
            operationId: envelope.operationId,
          },
          status: "enhancement-queued",
          error: null,
        },
        effects: [],
      };
    }
    case "CANCEL_ENHANCEMENTS": {
      const draft = state.activeDraft;
      if (draft?.kind !== "enhance" || draft.draftId !== command.draftId)
        return rejectDecision(state, command.type, "no-draft");
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: null,
          pendingEnhancementCommit: null,
          status: "result",
          error: null,
        },
        effects: [
          {
            type: "release-enhancement-draft",
            documentId: state.documentId,
            draftId: draft.draftId,
          },
        ],
      };
    }
    case "BEGIN_MAGIC_CUTOUT": {
      if (envelope.command.type !== "BEGIN_MAGIC_CUTOUT")
        return rejectDecision(state, command.type, "not-ready");
      const draftId = (
        envelope as Extract<
          DocumentCommandEnvelope,
          { command: { type: "BEGIN_MAGIC_CUTOUT" } }
        >
      ).draftId;
      if (state.status !== "result" || state.committed === null) {
        return rejectDecision(state, command.type, "no-result");
      }
      if (state.activeDraft !== null)
        return rejectDecision(state, command.type, "draft-active");
      if (command.expectedRevision !== state.revision) {
        return rejectDecision(state, command.type, "stale-revision");
      }
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: createMagicCutoutDraft({
            documentId: state.documentId,
            draftId,
            baselineRevision: state.revision,
          }),
          activeMagicPrediction: null,
          pendingMagicCommit: null,
          magicCandidates: [],
          error: null,
        },
        effects: [],
      };
    }
    case "MAGIC_DRAFT_CHANGED": {
      const draft = state.activeDraft;
      if (draft?.kind !== "magic-cutout" || draft.draftId !== command.draftId) {
        return rejectDecision(state, command.type, "no-draft");
      }
      if (
        command.expectedRevision !== state.revision ||
        draft.baselineRevision !== state.revision
      ) {
        return rejectDecision(state, command.type, "stale-revision");
      }
      if (command.draftRevision !== draft.draftRevision + 1) {
        return rejectDecision(state, command.type, "draft-revision-stale");
      }
      const effects: DocumentEffect[] = [];
      if (state.activeMagicPrediction !== null) {
        effects.push({
          type: "cancel-magic-prediction",
          documentId: state.documentId,
          draftId: draft.draftId,
          runId: state.activeMagicPrediction.runId,
        });
      }
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: {
            ...draft,
            draftRevision: command.draftRevision,
            dirty: command.dirty,
            status: command.dirty ? "dirty" : "ready",
            selectedCandidateId: null,
          },
          activeMagicPrediction: null,
          pendingMagicCommit: null,
          magicCandidates: [],
          status: "result",
          error: null,
        },
        effects,
      };
    }
    case "PREDICT_MAGIC_CUTOUT": {
      const draft = state.activeDraft;
      if (draft?.kind !== "magic-cutout" || draft.draftId !== command.draftId) {
        return rejectDecision(state, command.type, "no-draft");
      }
      if (state.activeMagicPrediction !== null) {
        return rejectDecision(state, command.type, "prediction-active");
      }
      if (
        command.expectedRevision !== state.revision ||
        draft.baselineRevision !== state.revision
      ) {
        return rejectDecision(state, command.type, "stale-revision");
      }
      if (command.draftRevision !== draft.draftRevision) {
        return rejectDecision(state, command.type, "draft-revision-stale");
      }
      if (!draft.dirty) return rejectDecision(state, command.type, "draft-not-dirty");
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: { ...draft, status: "encoding", selectedCandidateId: null },
          activeMagicPrediction: {
            documentId: state.documentId,
            draftId: draft.draftId,
            runId: command.runId,
            expectedRevision: command.expectedRevision,
            draftRevision: command.draftRevision,
          },
          magicCandidates: [],
          status: "magic-predicting",
          error: null,
        },
        effects: [],
      };
    }
    case "SELECT_MAGIC_CANDIDATE": {
      const draft = state.activeDraft;
      if (draft?.kind !== "magic-cutout" || draft.draftId !== command.draftId) {
        return rejectDecision(state, command.type, "no-draft");
      }
      if (
        command.expectedRevision !== state.revision ||
        command.draftRevision !== draft.draftRevision
      ) {
        return rejectDecision(state, command.type, "draft-revision-stale");
      }
      if (
        !state.magicCandidates.some((item) => item.candidateId === command.candidateId)
      ) {
        return rejectDecision(state, command.type, "no-candidate");
      }
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: { ...draft, selectedCandidateId: command.candidateId },
        },
        effects: [],
      };
    }
    case "APPLY_MAGIC_CUTOUT": {
      const draft = state.activeDraft;
      if (
        !("operationId" in envelope) ||
        draft?.kind !== "magic-cutout" ||
        draft.draftId !== command.draftId
      ) {
        return rejectDecision(state, command.type, "no-draft");
      }
      if (
        command.expectedRevision !== state.revision ||
        draft.baselineRevision !== state.revision
      ) {
        return rejectDecision(state, command.type, "stale-revision");
      }
      if (
        command.draftRevision !== draft.draftRevision ||
        state.activeMagicPrediction !== null
      ) {
        return rejectDecision(state, command.type, "draft-revision-stale");
      }
      if (
        !state.magicCandidates.some((item) => item.candidateId === command.candidateId)
      ) {
        return rejectDecision(state, command.type, "no-candidate");
      }
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          status: "magic-applying",
          pendingMagicCommit: {
            draftId: draft.draftId,
            candidateId: command.candidateId,
            expectedRevision: command.expectedRevision,
            draftRevision: command.draftRevision,
            operationId: envelope.operationId,
          },
          error: null,
        },
        effects: [],
      };
    }
    case "CANCEL_MAGIC_CUTOUT": {
      const draft = state.activeDraft;
      if (draft?.kind !== "magic-cutout" || draft.draftId !== command.draftId) {
        return rejectDecision(state, command.type, "no-draft");
      }
      const effects: DocumentEffect[] = [];
      if (state.activeMagicPrediction !== null) {
        effects.push({
          type: "cancel-magic-prediction",
          documentId: state.documentId,
          draftId: draft.draftId,
          runId: state.activeMagicPrediction.runId,
        });
      }
      effects.push({
        type: "release-magic-draft",
        documentId: state.documentId,
        draftId: draft.draftId,
      });
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: null,
          activeMagicPrediction: null,
          pendingMagicCommit: null,
          magicCandidates: [],
          status: "result",
          error: null,
        },
        effects,
      };
    }
    case "BEGIN_MANUAL_CUTOUT": {
      if (envelope.command.type !== "BEGIN_MANUAL_CUTOUT")
        return rejectDecision(state, command.type, "not-ready");
      const draftId = (
        envelope as Extract<
          DocumentCommandEnvelope,
          { command: { type: "BEGIN_MANUAL_CUTOUT" } }
        >
      ).draftId;
      if (state.status !== "result" || state.committed === null) {
        return rejectDecision(state, command.type, "no-result");
      }
      if (state.activeDraft !== null)
        return rejectDecision(state, command.type, "draft-active");
      if (command.expectedRevision !== state.revision) {
        return rejectDecision(state, command.type, "stale-revision");
      }
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: {
            kind: "manual-cutout",
            draftId,
            documentId: state.documentId,
            baselineRevision: state.revision,
            dirty: false,
          },
          error: null,
        },
        effects: [],
      };
    }
    case "CANCEL_MANUAL_CUTOUT": {
      if (
        state.activeDraft?.kind !== "manual-cutout" ||
        state.activeDraft.draftId !== command.draftId
      ) {
        return rejectDecision(state, command.type, "no-draft");
      }
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          activeDraft: null,
          pendingManualCommit: null,
          status: "result",
          error: null,
        },
        effects: [
          {
            type: "release-manual-draft",
            documentId: state.documentId,
            draftId: command.draftId,
          },
        ],
      };
    }
    case "APPLY_MANUAL_CUTOUT": {
      if (
        !("operationId" in envelope) ||
        state.activeDraft?.kind !== "manual-cutout" ||
        state.activeDraft.draftId !== command.draftId
      ) {
        return rejectDecision(state, command.type, "no-draft");
      }
      if (
        command.expectedRevision !== state.revision ||
        state.activeDraft.baselineRevision !== state.revision
      ) {
        return rejectDecision(state, command.type, "stale-revision");
      }
      if (!state.activeDraft.dirty)
        return rejectDecision(state, command.type, "draft-not-dirty");
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          status: "manual-applying",
          error: null,
          pendingManualCommit: {
            draftId: command.draftId,
            draftMatte: command.draftMatte,
            expectedRevision: command.expectedRevision,
            operationId: envelope.operationId,
          },
        },
        effects: [],
      };
    }
    case "UNDO_DOCUMENT":
    case "REDO_DOCUMENT": {
      if (state.activeDraft !== null)
        return rejectDecision(state, command.type, "draft-active");
      if (state.committed === null)
        return rejectDecision(state, command.type, "no-result");
      if (command.expectedRevision !== state.revision)
        return rejectDecision(state, command.type, "stale-revision");
      const move =
        command.type === "UNDO_DOCUMENT"
          ? undoDocumentHistory(state.history)
          : redoDocumentHistory(state.history);
      if (move.snapshot === null)
        return rejectDecision(state, command.type, "history-boundary");
      if (state.revision === Number.MAX_SAFE_INTEGER)
        return rejectDecision(state, command.type, "stale-revision");
      return {
        outcome: accepted(command.type),
        state: {
          ...state,
          committed: move.snapshot,
          history: move.history,
          revision: state.revision + 1,
          error: null,
        },
        effects: [
          {
            type: "move-document-history",
            documentId: state.documentId,
            from: state.committed,
            to: move.snapshot,
          },
        ],
      };
    }
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
      if (state.activeMagicPrediction !== null) {
        effects.push({
          type: "cancel-magic-prediction",
          documentId: state.documentId,
          draftId: state.activeMagicPrediction.draftId,
          runId: state.activeMagicPrediction.runId,
        });
      }
      if (state.activeDraft?.kind === "manual-cutout") {
        effects.push({
          type: "release-manual-draft",
          documentId: state.documentId,
          draftId: state.activeDraft.draftId,
        });
      } else if (state.activeDraft?.kind === "magic-cutout") {
        effects.push({
          type: "release-magic-draft",
          documentId: state.documentId,
          draftId: state.activeDraft.draftId,
        });
      } else if (state.activeDraft?.kind === "background") {
        effects.push({
          type: "release-background-draft",
          documentId: state.documentId,
          draftId: state.activeDraft.draftId,
        });
      } else if (state.activeDraft?.kind === "enhance") {
        effects.push({
          type: "release-enhancement-draft",
          documentId: state.documentId,
          draftId: state.activeDraft.draftId,
        });
      }
      effects.push({ type: "release-document", documentId: state.documentId });
      return {
        outcome: accepted(command.type),
        state: {
          ...clearRun(state, "disposed", null),
          activeDraft: null,
          pendingManualCommit: null,
          activeMagicPrediction: null,
          pendingMagicCommit: null,
          pendingBackgroundCommit: null,
          pendingEnhancementCommit: null,
          magicCandidates: [],
        },
        effects,
      };
    }
  }
}
