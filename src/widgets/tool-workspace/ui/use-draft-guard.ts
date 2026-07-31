import { useCallback, useRef, useState, type RefObject } from "react";

import type { BackgroundFill } from "../../../entities/processed-image";
import type { AlphaMatte } from "../../../entities/processed-image";
import type { RemoveBackgroundState } from "../../../features/remove-background";
import type { useGuidedBrushSelection } from "../../../features/select-object";
import type { BatchItem } from "../../../features/batch-processing";
import type { EditorToolId } from "../model/editor-tool-registry";

export interface DraftGuardDeps {
  activeDocumentId: string | null;
  activeTool: EditorToolId;
  guided: ReturnType<typeof useGuidedBrushSelection>;
  finalizingCorrection: boolean;
  originalMatte: AlphaMatte | null;
  backgroundDraftDirty: boolean;
  enhancementDraftDirty: boolean;
  activeEnhancementStatus: string;
  selectedBatchItem: BatchItem | undefined;
  state: RemoveBackgroundState;
  cancelGuided: () => void;
  handleCancelCorrection: () => void;
  setPreviewFill: (fill: BackgroundFill) => void;
  setBatchPreviewFills: (
    update: (current: Record<string, BackgroundFill>) => Record<string, BackgroundFill>,
  ) => void;
  cancelEnhancements: () => void;
  clearEnhancementDraft: () => void;
  activateTool: (tool: EditorToolId) => void;
  setBackgroundDraftDirty: (dirty: boolean) => void;
  batchSelectedItemId: string | null;
  batchRetryItem: (id: string) => void;
  batchRemoveItem: (id: string) => void;
  handleSelectBatchItem: (id: string) => void;
  handleClearBatch: () => void;
  handleReset: () => void;
  releaseRefinementBeforeHeavyWork: () => Promise<void>;
  initializedMagicDocumentRef: RefObject<string | null>;
  initializedManualDocumentRef: RefObject<string | null>;
}

/**
 * The "unsaved changes" navigation guard for `ToolWorkspace.tsx`: tracks
 * whether the active tool has an uncommitted draft (guided-cutout markings,
 * manual mask edits, background preview, or enhancement selections) and, if
 * so, intercepts tool/batch/reset navigation with a confirm-discard prompt
 * instead of silently dropping the draft. (PHASE_31 F-24 follow-up, second
 * slice of the component's own state — see `use-document-ui-state.ts` for
 * the first.)
 */
export function useDraftGuard(deps: DraftGuardDeps) {
  const [pendingTool, setPendingTool] = useState<EditorToolId | null>(null);
  const [pendingBatchItem, setPendingBatchItem] = useState<string | null>(null);
  const [pendingBatchReprocess, setPendingBatchReprocess] = useState<string | null>(null);
  const [pendingBatchRemove, setPendingBatchRemove] = useState<string | null>(null);
  const [pendingBatchClear, setPendingBatchClear] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);
  const pendingToolTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [manualDraftDirty, setManualDraftDirty] = useState(false);
  const [manualDraftResetKey, setManualDraftResetKey] = useState(0);

  const handleManualDirtyChange = useCallback((dirty: boolean) => {
    setManualDraftDirty(dirty);
  }, []);

  const guidedDraftDirty = Boolean(
    deps.guided.state.session?.strokes.length ||
    deps.guided.state.status === "predicting" ||
    deps.finalizingCorrection,
  );

  const activeDraftDirty =
    deps.activeTool === "cutout"
      ? guidedDraftDirty || manualDraftDirty
      : deps.activeTool === "enhance"
        ? deps.enhancementDraftDirty || deps.activeEnhancementStatus !== "idle"
        : deps.activeTool === "background" && deps.backgroundDraftDirty;

  function clearPendingGuard() {
    setPendingTool(null);
    setPendingBatchItem(null);
    setPendingBatchReprocess(null);
    setPendingBatchRemove(null);
    setPendingBatchClear(false);
    setPendingReset(false);
  }

  function dismissPendingGuard() {
    clearPendingGuard();
    requestAnimationFrame(() => pendingToolTriggerRef.current?.focus());
  }

  const { initializedMagicDocumentRef, initializedManualDocumentRef } = deps;

  function prepareActiveBatchMutation(id: string) {
    if (id !== deps.batchSelectedItemId) return;
    if (deps.guided.state.session) deps.cancelGuided();
    if (deps.originalMatte) deps.handleCancelCorrection();
    initializedMagicDocumentRef.current = null;
    initializedManualDocumentRef.current = null;
    setManualDraftDirty(false);
  }

  function executeBatchReprocess(id: string) {
    prepareActiveBatchMutation(id);
    void deps.releaseRefinementBeforeHeavyWork().then(() => deps.batchRetryItem(id));
  }

  function executeBatchRemove(id: string) {
    prepareActiveBatchMutation(id);
    deps.batchRemoveItem(id);
  }

  function requestTool(tool: EditorToolId, trigger: HTMLButtonElement) {
    if (tool === deps.activeTool) return;
    if (activeDraftDirty) {
      pendingToolTriggerRef.current = trigger;
      setPendingTool(tool);
      return;
    }
    deps.activateTool(tool);
  }

  function requestBatchItem(id: string, trigger: HTMLButtonElement) {
    if (id === deps.batchSelectedItemId) return;
    if (activeDraftDirty) {
      pendingToolTriggerRef.current = trigger;
      setPendingBatchItem(id);
      return;
    }
    deps.handleSelectBatchItem(id);
  }

  function requestBatchReprocess(id: string, trigger: HTMLButtonElement) {
    if (id === deps.batchSelectedItemId && activeDraftDirty) {
      pendingToolTriggerRef.current = trigger;
      setPendingBatchReprocess(id);
      return;
    }
    executeBatchReprocess(id);
  }

  function requestBatchRemove(id: string, trigger: HTMLButtonElement) {
    if (id === deps.batchSelectedItemId && activeDraftDirty) {
      pendingToolTriggerRef.current = trigger;
      setPendingBatchRemove(id);
      return;
    }
    executeBatchRemove(id);
  }

  function requestBatchClear(trigger: HTMLButtonElement) {
    if (activeDraftDirty) {
      pendingToolTriggerRef.current = trigger;
      setPendingBatchClear(true);
      return;
    }
    deps.handleClearBatch();
  }

  function requestReset(trigger: HTMLButtonElement) {
    if (activeDraftDirty) {
      pendingToolTriggerRef.current = trigger;
      setPendingReset(true);
      return;
    }
    deps.handleReset();
  }

  function clearActiveDraftState() {
    if (deps.guided.state.session) deps.cancelGuided();
    if (deps.originalMatte) deps.handleCancelCorrection();
    if (deps.activeDocumentId && deps.backgroundDraftDirty) {
      const appliedFill = deps.selectedBatchItem?.processedImage?.backgroundFill ??
        (deps.state.status === "result" || deps.state.status === "correcting"
          ? deps.state.result.backgroundFill
          : undefined) ?? { type: "transparent" };
      if (deps.selectedBatchItem) {
        const batchItemId = deps.selectedBatchItem.id;
        deps.setBatchPreviewFills((current) => ({
          ...current,
          [batchItemId]: appliedFill,
        }));
      } else {
        deps.setPreviewFill(appliedFill);
      }
      deps.setBackgroundDraftDirty(false);
    }
    if (deps.activeDocumentId && deps.activeTool === "enhance") {
      deps.cancelEnhancements();
      deps.clearEnhancementDraft();
    }
    if (manualDraftDirty) setManualDraftResetKey((current) => current + 1);
    setManualDraftDirty(false);
  }

  function discardActiveDraft() {
    if (pendingTool) {
      const nextTool = pendingTool;
      deps.activateTool(nextTool);
      setManualDraftDirty(false);
      clearPendingGuard();
      requestAnimationFrame(() => pendingToolTriggerRef.current?.focus());
      window.setTimeout(clearActiveDraftState, 100);
      return;
    }
    clearActiveDraftState();
    if (pendingBatchItem) deps.handleSelectBatchItem(pendingBatchItem);
    else if (pendingBatchReprocess) executeBatchReprocess(pendingBatchReprocess);
    else if (pendingBatchRemove) executeBatchRemove(pendingBatchRemove);
    else if (pendingBatchClear) deps.handleClearBatch();
    else if (pendingReset) deps.handleReset();
    clearPendingGuard();
    requestAnimationFrame(() => pendingToolTriggerRef.current?.focus());
  }

  const draftGuardOpen = Boolean(
    pendingTool ||
    pendingBatchItem ||
    pendingBatchReprocess ||
    pendingBatchRemove ||
    pendingBatchClear ||
    pendingReset,
  );

  return {
    manualDraftDirty,
    manualDraftResetKey,
    handleManualDirtyChange,
    activeDraftDirty,
    draftGuardOpen,
    pendingToolTriggerRef,
    requestTool,
    requestBatchItem,
    requestBatchReprocess,
    requestBatchRemove,
    requestBatchClear,
    requestReset,
    discardActiveDraft,
    dismissPendingGuard,
  };
}
