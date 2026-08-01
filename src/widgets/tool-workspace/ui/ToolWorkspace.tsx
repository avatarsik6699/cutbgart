import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Images, Loader2 } from "lucide-react";

import type { QualityMode } from "../../../entities/processed-image";
import { BeforeAfterSlider } from "../../../entities/processed-image";
import { useMaskCorrectionViewport } from "../../../features/correct-mask";
import { DownloadSplitButton } from "../../../features/download-result";
import { BatchGrid, type BatchItem } from "../../../features/batch-processing";
import {
  QualityModePopover,
  QualityModeToggle,
} from "../../../features/quality-mode-toggle";
import { GuidedBrushCanvas, GuidedBrushControls } from "../../../features/select-object";
import {
  ChoosePhotoButton,
  UploadDropzone,
  UploadPreparationNotice,
} from "../../../features/upload-image";
import { Button, Skeleton } from "@/shared/ui";
import { useHeaderUtilityPortalTarget } from "@/shared/ui/header-utility-portal-context";
import { m } from "@/paraglide/messages";
import { clearModelCache } from "@/features/model-storage";
import { describeGuidedState, describeState } from "../lib/describe-state";
import {
  createEnhancementDraft,
  createEnhancementOperationRegistry,
  updateEnhancementDraft,
  type EnhancementDraft,
  type EnhancementOperationId,
} from "../model/enhancement-operation-registry";
import { useToolWorkspaceController } from "../model/use-tool-workspace-controller";
import { LocalExecutionReadout } from "./LocalExecutionReadout";
import { createEditorToolRegistry } from "../model/editor-tool-registry";
import { EditorStage } from "./EditorStage";
import type { EditorStageFullscreenControls } from "./EditorStage";
import { EditorToolbar } from "./EditorToolbar";
import { BrushSizeStagePreview } from "./BrushSizeStagePreview";
import { BackgroundToolPanel } from "./BackgroundToolPanel";
import { CutoutToolPanel, type CutoutIntent, type CutoutMode } from "./CutoutToolPanel";
import { EnhancementsToolPanel } from "./EnhancementsToolPanel";
import { CanvasViewControls } from "./CanvasViewControls";
import { DiagnosticsSheet } from "./DiagnosticsSheet";
import { ToolPanelSlot } from "./ToolPanelSlot";
import { PersistentPreviewLayers } from "./PersistentPreviewLayers";
import { MaskCorrectionSlots } from "./MaskCorrectionSlots";
import { UploadErrorNotice } from "./UploadErrorNotice";
import { CorrectionErrorAlert, type DisplayError } from "./CorrectionErrorAlert";
import { useDocumentUiState } from "./use-document-ui-state";
import { useDraftGuard } from "./use-draft-guard";

function modeLabel(mode: QualityMode): string {
  if (mode === "max" || mode === "isnet-fp32") return m.processingModePrecise();
  if (mode === "ben2-fp16") return m.processingModeBen2();
  return m.processingModeFast();
}

/**
 * Upload -> quality-toggle -> process -> preview -> background-fill ->
 * download composition, extracted from the copy previously duplicated across
 * `pages/home` and the four Phase-06 scenario pages (Phase 12 F4,
 * `PHASE_06.md` Implementation Notes debt). Self-contained: no props, same as
 * each page previously owned this state privately.
 *
 * Layout: `.tool-workspace-grid` (globals.css) gives a single mobile/tablet
 * column in the pre-Phase-12 stacking order, and an `lg:` two-column split
 * (preview surface left, control rail right) via CSS grid-template-areas —
 * not just DOM order — so both constraints hold at once.
 */
export function ToolWorkspace({
  emptyIntroSlot,
}: {
  emptyIntroSlot?: ReactNode;
} = {}) {
  const headerUtilityTarget = useHeaderUtilityPortalTarget();
  const {
    uploadError,
    preparingFileCount,
    setPreparingFileCount,
    originalMatte,
    extractingMatte,
    finalizingCorrection,
    correctionError,
    canvasDecodeRetryToken,
    handleCanvasDecodeError,
    correctionViewAnnouncement,
    setCorrectionViewAnnouncement,
    previewFill,
    setPreviewFill,
    batchPreviewFills,
    setBatchPreviewFills,
    hydrated,
    guidedVisualContext,
    guided,
    guidedViewSession,
    enhancementState,
    enhancementProgress,
    qualityMode,
    setQualityMode,
    state,
    deviceCapabilities,
    lightweightMode,
    runInfo,
    logs,
    modelLoadBytes,
    ben2FallbackNotice,
    retry,
    retryInLightweightMode,
    applyBackgroundFill,
    releaseRefinementBeforeHeavyWork,
    batch,
    batchModelKey,
    selectedBatchItem,
    activeEditDocument,
    historySelectors,
    handleUpload,
    handleUploads,
    handleDismissUploadError,
    handleReset,
    handleApplyGuided,
    handleGuideAutomaticResult,
    handleGuideBatchResult,
    synchronizeSingleGuidedTarget,
    synchronizeBatchGuidedTarget,
    applySingleEnhancements,
    applyBatchEnhancements,
    cancelEnhancements,
    retryEnhancements,
    handleRetry,
    handleEditMask,
    handleBatchEditMask,
    handleSelectBatchItem,
    handleClearBatch,
    handleBatchDoneCorrecting,
    handleDoneCorrecting,
    handleCancelCorrection,
    handleUndoDocument,
    handleRedoDocument,
    commitSingleBackground,
    commitBatchBackground,
    cancelGuided,
  } = useToolWorkspaceController();

  const busy = state.status === "model-loading" || state.status === "processing";
  const tools = useMemo(() => createEditorToolRegistry(), []);
  const enhancementRegistry = useMemo(() => createEnhancementOperationRegistry(), []);
  const activeDocumentId =
    activeEditDocument?.document.id ??
    selectedBatchItem?.id ??
    (state.status === "result" || state.status === "correcting" ? "single-result" : null);
  const activeDocumentVersion = activeDocumentId
    ? `${activeDocumentId}:${String(activeEditDocument?.document.revision ?? 0)}`
    : null;
  const documentUiState = useDocumentUiState(activeDocumentId);
  const [magicIntent, setMagicIntent] = useState<CutoutIntent>("keep");
  const [magicPreviewKey, setMagicPreviewKey] = useState(0);
  const [manualPreviewKey, setManualPreviewKey] = useState(0);
  const [enhancementDraftByDocument, setEnhancementDraftByDocument] = useState<
    Record<string, EnhancementDraft>
  >({});
  const activeSource =
    selectedBatchItem?.processedImage?.source ??
    (state.status === "result" || state.status === "correcting"
      ? state.result.source
      : null);
  const cutoutViewport = useMaskCorrectionViewport(
    {
      width: activeSource?.width ?? 1,
      height: activeSource?.height ?? 1,
    },
    activeDocumentId ?? "no-document",
  );
  const magicSurfaceRef = useRef<HTMLCanvasElement>(null);
  const manualSurfaceRef = useRef<HTMLCanvasElement>(null);
  const initializedMagicDocumentRef = useRef<string | null>(null);
  const initializedManualDocumentRef = useRef<string | null>(null);
  const defaultEnhancementDraft = useMemo(
    () =>
      createEnhancementDraft(enhancementRegistry, {
        inferencePath: deviceCapabilities?.inferencePath ?? null,
      }),
    [deviceCapabilities?.inferencePath, enhancementRegistry],
  );
  const enhancementDraft = activeDocumentId
    ? (enhancementDraftByDocument[activeDocumentId] ?? defaultEnhancementDraft)
    : defaultEnhancementDraft;
  const activeEnhancementStatus =
    enhancementState.documentId === activeDocumentId ? enhancementState.status : "idle";
  const visibleEnhancementDraft: EnhancementDraft = {
    ...enhancementDraft,
    status: activeEnhancementStatus,
  };
  const draftGuard = useDraftGuard({
    activeDocumentId,
    activeTool: documentUiState.activeTool,
    guided,
    finalizingCorrection,
    originalMatte,
    backgroundDraftDirty: documentUiState.backgroundDraftDirty,
    enhancementDraftDirty: enhancementDraft.dirty,
    activeEnhancementStatus,
    selectedBatchItem,
    state,
    cancelGuided,
    handleCancelCorrection,
    setPreviewFill,
    setBatchPreviewFills,
    cancelEnhancements,
    clearEnhancementDraft: () => {
      if (!activeDocumentId) return;
      setEnhancementDraftByDocument((current) => ({
        ...current,
        [activeDocumentId]: defaultEnhancementDraft,
      }));
    },
    activateTool: documentUiState.activateTool,
    setBackgroundDraftDirty: documentUiState.setBackgroundDraftDirty,
    batchSelectedItemId: batch.session.selectedItemId,
    batchRetryItem: batch.retryItem,
    batchRemoveItem: batch.removeItem,
    handleSelectBatchItem,
    handleClearBatch,
    handleReset,
    releaseRefinementBeforeHeavyWork,
    initializedMagicDocumentRef,
    initializedManualDocumentRef,
  });
  useEffect(() => {
    if (
      !activeDocumentVersion ||
      documentUiState.activeTool !== "cutout" ||
      documentUiState.cutoutMode !== "magic" ||
      extractingMatte ||
      initializedMagicDocumentRef.current === activeDocumentVersion
    )
      return;
    initializedMagicDocumentRef.current = activeDocumentVersion;
    if (guided.state.session) {
      if (selectedBatchItem?.processedImage && selectedBatchItem.editDocument)
        synchronizeBatchGuidedTarget(selectedBatchItem);
      else if (
        (state.status === "result" || state.status === "correcting") &&
        activeEditDocument
      )
        synchronizeSingleGuidedTarget(state.result, activeEditDocument);
      return;
    }
    if (selectedBatchItem?.processedImage && selectedBatchItem.status === "result") {
      handleGuideBatchResult();
    } else if (state.status === "result") {
      handleGuideAutomaticResult();
    }
    // The controller handlers intentionally capture the current document
    // target; document identity is the effect's lifecycle key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeDocumentVersion,
    documentUiState.activeTool,
    documentUiState.cutoutMode,
    extractingMatte,
    guided.state.session,
    selectedBatchItem?.id,
    state.status,
  ]);

  useEffect(() => {
    if (
      !activeDocumentVersion ||
      documentUiState.activeTool !== "cutout" ||
      documentUiState.cutoutMode !== "manual" ||
      extractingMatte ||
      initializedManualDocumentRef.current === activeDocumentVersion
    )
      return;
    initializedManualDocumentRef.current = activeDocumentVersion;
    if (selectedBatchItem?.processedImage) handleBatchEditMask();
    else if (state.status === "result" || state.status === "correcting") handleEditMask();
    // As above, the active document identity owns this transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeDocumentVersion,
    documentUiState.activeTool,
    documentUiState.cutoutMode,
    extractingMatte,
    originalMatte,
    selectedBatchItem?.id,
    state.status,
  ]);

  // Auto-select the first finished batch item so the editor/tools surface
  // appears as soon as anything is ready, mirroring the single-image flow
  // instead of leaving the user staring at an empty rail until they click a
  // thumbnail themselves.
  useEffect(() => {
    if (batch.session.selectedItemId) return;
    const firstReady = batch.session.items.find((item) => item.status === "result");
    if (firstReady) handleSelectBatchItem(firstReady.id);
  }, [batch.session.items, batch.session.selectedItemId, handleSelectBatchItem]);

  function selectCutoutMode(mode: CutoutMode) {
    if (!activeDocumentId || mode === documentUiState.cutoutMode) return;
    if (mode === "manual" && extractingMatte && !guided.state.session) {
      cancelGuided();
    } else if (mode === "magic" && extractingMatte && !originalMatte) {
      handleCancelCorrection();
    }
    documentUiState.setCutoutMode(mode);
  }

  function cancelMagicDraft(): void {
    guided.cancelDraft();
    setCorrectionViewAnnouncement(m.cutoutDraftCancelled());
  }

  function downloadBatchItem(item: BatchItem) {
    if (!item.processedImage || item.processedImage.backgroundPending) return;
    const completedIndex = batch.session.items
      .filter((candidate) => candidate.processedImage)
      .findIndex((candidate) => candidate.id === item.id);
    const url = URL.createObjectURL(item.processedImage.result);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cutbg-result-${String(Math.max(0, completedIndex) + 1)}.png`;
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function updateEnhancementOperation(
    operationId: EnhancementOperationId,
    selected: boolean,
  ) {
    if (!activeDocumentId) return;
    setEnhancementDraftByDocument((current) => ({
      ...current,
      [activeDocumentId]: updateEnhancementDraft(
        current[activeDocumentId] ?? defaultEnhancementDraft,
        operationId,
        selected,
      ),
    }));
  }

  function cancelEnhancementDraft() {
    cancelEnhancements();
  }

  function markEnhancementDraftApplied() {
    if (!activeDocumentId) return;
    setEnhancementDraftByDocument((current) => ({
      ...current,
      [activeDocumentId]: { ...enhancementDraft, dirty: false },
    }));
  }

  function applySingleEnhancementDraft() {
    if (!activeDocumentId || (state.status !== "result" && state.status !== "correcting"))
      return;
    markEnhancementDraftApplied();
    applySingleEnhancements(
      state.result,
      enhancementDraft.selectedOperationIds,
      enhancementRegistry[0]?.historyLabel ?? m.editorToolEnhance(),
    );
  }

  function applyBatchEnhancementDraft() {
    if (!activeDocumentId || !selectedBatchItem?.processedImage) return;
    markEnhancementDraftApplied();
    applyBatchEnhancements(
      selectedBatchItem.id,
      selectedBatchItem.processedImage,
      enhancementDraft.selectedOperationIds,
      enhancementRegistry[0]?.historyLabel ?? m.editorToolEnhance(),
    );
  }

  // Upload-validation errors (`uploadError`) are rendered in place inside the
  // owning upload surface via `UploadErrorNotice` below (PHASE_31 T8/F7), not
  // through this shared error slot — they never hide the idle/batch controls
  // or move down the page. `displayError` covers only in-flight
  // workflow/model errors, which genuinely need to preempt the surface.
  const displayError: DisplayError | null =
    state.status === "error"
      ? { message: state.error.message, action: state.error.action }
      : null;
  const verifiedAssetError =
    state.status === "error" && state.error.code === "model-load-failed";

  // Two grid slots (`.tool-workspace-grid`, globals.css): `surface` is the
  // visual/preview area (upload UI, batch grid, before/after slider, mask
  // canvas), `rail` is the control area next to it (background-fill picker,
  // action buttons, mask toolbar). Exactly one state block populates them
  // per render — see the `state.status` branches below.
  let surfaceNode: ReactNode = null;
  let railNode: ReactNode = null;

  const canvasViewControls = activeDocumentId
    ? ({ expanded, toggleFullscreen }: EditorStageFullscreenControls) => (
        <CanvasViewControls
          interactionMode={documentUiState.interactionMode}
          onInteractionModeChange={documentUiState.setInteractionMode}
          zoomPercent={cutoutViewport.zoomPercent}
          canZoomIn={cutoutViewport.canZoomIn}
          canZoomOut={cutoutViewport.canZoomOut}
          canPan={cutoutViewport.canPan}
          onZoomIn={cutoutViewport.zoomIn}
          onZoomOut={() => {
            cutoutViewport.zoomOut();
            if (cutoutViewport.zoomPercent <= 125)
              documentUiState.setInteractionMode("brush");
          }}
          onResetView={() => {
            cutoutViewport.resetView();
            documentUiState.setInteractionMode("brush");
          }}
          expanded={expanded}
          onToggleFullscreen={toggleFullscreen}
          collapsed={documentUiState.viewControlsCollapsed}
          onCollapsedChange={documentUiState.setViewControlsCollapsed}
        />
      )
    : undefined;

  const guidedCanvas =
    guided.state.session && guidedViewSession && guidedVisualContext ? (
      <div className="relative size-full">
        <GuidedBrushCanvas
          session={guidedViewSession}
          status={guided.state.status}
          baseMatteRef={guided.baseMatteRef}
          baseMatteRevision={guided.state.baseMatteRevision}
          entryKind={guidedVisualContext.entryKind}
          applying={finalizingCorrection}
          active={
            documentUiState.activeTool === "cutout" &&
            documentUiState.cutoutMode === "magic"
          }
          mode={magicIntent}
          viewportControls={cutoutViewport}
          interactionMode={documentUiState.interactionMode}
          surfaceTargetRef={magicSurfaceRef}
          promptCounts={{
            total: guided.state.lastPromptCount,
            keep: guided.state.lastPromptKeepCount,
            remove: guided.state.lastPromptRemoveCount,
          }}
          onStroke={guided.addStroke}
          onUndo={guided.undo}
          onRedo={guided.redo}
        />
        <BrushSizeStagePreview
          sourceDiameter={guidedViewSession.brushRadius * 2}
          sourceWidth={guidedViewSession.source.width}
          targetRef={magicSurfaceRef}
          interactionKey={magicPreviewKey}
          tone={magicIntent}
          coreRatio={1 / 3}
        />
      </div>
    ) : null;

  const magicControls =
    guided.state.session && guidedViewSession ? (
      <GuidedBrushControls
        mode={magicIntent}
        onModeChange={setMagicIntent}
        session={guidedViewSession}
        status={guided.state.status}
        progress={guided.state.progress}
        applying={finalizingCorrection}
        canApply={guided.canApply}
        onBrushRadiusChange={guided.setBrushRadius}
        onBrushSizeInteraction={() => setMagicPreviewKey((current) => current + 1)}
        onApply={() => void handleApplyGuided()}
        onCancel={cancelMagicDraft}
        onRetry={guided.retry}
      />
    ) : extractingMatte ? (
      <div
        className="flex items-start gap-2 text-sm text-muted-foreground"
        aria-busy="true"
      >
        <Loader2
          className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p>{m.cutoutMagicExtractingHint()}</p>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">{m.cutoutMagicReady()}</p>
    );

  if (!displayError && state.status === "idle" && !batch.session.items.length) {
    surfaceNode = guidedCanvas ?? (
      <section className="command-deck relative isolate flex min-h-[30rem] flex-col justify-center gap-5 px-1 py-5 sm:px-3 sm:py-7">
        <span
          aria-hidden="true"
          className="command-deck-ambient command-deck-ambient-primary"
        />
        <span
          aria-hidden="true"
          className="command-deck-ambient command-deck-ambient-secondary"
        />
        <QualityModeToggle
          qualityMode={qualityMode}
          onQualityModeChange={setQualityMode}
          disabled={!hydrated}
        />
        <UploadDropzone
          onUpload={handleUpload}
          onUploads={handleUploads}
          onPreparationChange={setPreparingFileCount}
          disabled={!hydrated || busy || preparingFileCount > 0}
          className="command-deck-dropzone border border-border bg-background/50 backdrop-blur-sm"
        />
        <ChoosePhotoButton
          onUpload={handleUpload}
          onUploads={handleUploads}
          onPreparationChange={setPreparingFileCount}
          disabled={!hydrated || busy || preparingFileCount > 0}
        />
        <UploadPreparationNotice fileCount={preparingFileCount} />
        {uploadError && (
          <UploadErrorNotice error={uploadError} onDismiss={handleDismissUploadError} />
        )}
      </section>
    );
  }

  // Batch base content — independent of whether the selected item is
  // currently being mask-corrected. Reused as-is below (no correction) and
  // combined with `MaskCorrectionSlots`' output (correction active).
  const batchActive = !displayError && batch.session.items.length > 0;
  const batchActionsNode = batchActive ? (
    <>
      <QualityModePopover
        qualityMode={qualityMode}
        onQualityModeChange={setQualityMode}
        disabled={!hydrated}
      />
      <ChoosePhotoButton
        onUpload={handleUpload}
        onUploads={handleUploads}
        onPreparationChange={setPreparingFileCount}
        disabled={!hydrated || preparingFileCount > 0}
        batchMode
        label={m.addImages()}
        className="h-8 w-auto px-3 py-0 sm:flex"
      />
    </>
  ) : null;
  const batchListNode = batchActive ? (
    <>
      {uploadError && (
        <UploadErrorNotice error={uploadError} onDismiss={handleDismissUploadError} />
      )}
      <BatchGrid
        items={batch.session.items}
        selectedItemId={batch.session.selectedItemId}
        snapshot={batch.snapshot}
        modelLoad={batch.session.modelLoads[batchModelKey]}
        onSelect={draftGuard.requestBatchItem}
        onDownload={downloadBatchItem}
        onRetry={draftGuard.requestBatchReprocess}
        onRemove={draftGuard.requestBatchRemove}
      />
    </>
  ) : null;
  const batchSurfaceBase = batchActive ? (
    <section
      className="flex size-full min-w-0 flex-col"
      aria-label={m.batchEditorTitle()}
    >
      {selectedBatchItem?.processedImage && !originalMatte && (
        <div
          className="size-full"
          aria-label={m.batchSelectedAria({ name: selectedBatchItem.originalFileName })}
        >
          <PersistentPreviewLayers
            activeLayer={
              documentUiState.activeTool === "cutout" &&
              documentUiState.cutoutMode === "magic" &&
              guidedCanvas
                ? "magic"
                : "comparison"
            }
            magic={guidedCanvas}
            comparison={
              <BeforeAfterSlider
                before={selectedBatchItem.processedImage.source}
                after={
                  selectedBatchItem.processedImage.cutout ??
                  selectedBatchItem.processedImage.result
                }
                backgroundFill={
                  batchPreviewFills[selectedBatchItem.id] ??
                  selectedBatchItem.processedImage.backgroundFill
                }
                position={documentUiState.viewPosition}
                onPositionChange={documentUiState.setViewPosition}
              />
            }
          />
        </div>
      )}
      {!selectedBatchItem?.processedImage &&
        (batch.snapshot.activeCount > 0 || batch.snapshot.queuedCount > 0 ? (
          <EditorStage documentId="batch-loading" loading>
            <p
              className="rounded-full border border-border bg-background/90 px-4 py-2 font-mono text-sm font-medium text-foreground"
              data-testid="batch-stage-skeleton"
            >
              {m.removingBackground()}
            </p>
          </EditorStage>
        ) : (
          <div className="grid size-full min-[56rem]:min-h-72 place-items-center rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <div className="max-w-xs">
              <Images
                className="mx-auto mb-3 size-8 text-muted-foreground/60"
                aria-hidden="true"
              />
              <p>{m.batchEditorEmpty()}</p>
            </div>
          </div>
        ))}
    </section>
  ) : null;

  const batchStillLoading =
    !selectedBatchItem?.processedImage &&
    (batch.snapshot.activeCount > 0 || batch.snapshot.queuedCount > 0);

  const batchRailBase = batchActive ? (
    batchStillLoading ? (
      <Skeleton
        className="min-h-72 rounded-lg border border-border min-[56rem]:h-[clamp(22rem,62dvh,46rem)]"
        data-testid="batch-panel-skeleton"
      />
    ) : (
      <ToolPanelSlot
        toolId={documentUiState.activeTool}
        label={tools.find(({ id }) => id === documentUiState.activeTool)?.label ?? ""}
        fitContent={!selectedBatchItem?.processedImage}
      >
        {selectedBatchItem?.processedImage ? (
          <div className="flex flex-col gap-4" data-testid="batch-controls">
            {documentUiState.activeTool === "cutout" && (
              <CutoutToolPanel
                mode={documentUiState.cutoutMode}
                onModeChange={selectCutoutMode}
                magicControls={magicControls}
                manualControls={
                  <p
                    className="text-sm text-muted-foreground"
                    aria-busy={extractingMatte}
                  >
                    {extractingMatte ? m.preparing() : m.cutoutManualReady()}
                  </p>
                }
              />
            )}
            {documentUiState.activeTool === "enhance" && (
              <EnhancementsToolPanel
                registry={enhancementRegistry}
                draft={visibleEnhancementDraft}
                progress={enhancementProgress}
                activeOperationId={enhancementState.activeOperationId}
                outcome={
                  enhancementState.documentId === activeDocumentId
                    ? enhancementState.outcome
                    : null
                }
                errorCode={
                  enhancementState.documentId === activeDocumentId
                    ? enhancementState.errorCode
                    : null
                }
                disabled={Boolean(
                  batch.snapshot.activeCount || batch.snapshot.queuedCount,
                )}
                onOperationChange={updateEnhancementOperation}
                onApply={applyBatchEnhancementDraft}
                onCancel={cancelEnhancementDraft}
                onRetry={retryEnhancements}
              />
            )}
            {documentUiState.activeTool === "background" && (
              <BackgroundToolPanel
                image={{
                  source: selectedBatchItem.processedImage.source,
                  backgroundFill: selectedBatchItem.processedImage.backgroundFill,
                }}
                onPreview={(fill) => {
                  setBatchPreviewFills((current) => ({
                    ...current,
                    [selectedBatchItem.id]: fill,
                  }));
                }}
                onApply={(fill) =>
                  batch.applyBackgroundFill(selectedBatchItem.processedImage!, fill)
                }
                onResult={(updated) => {
                  commitBatchBackground(selectedBatchItem.id, updated);
                  setBatchPreviewFills((current) => ({
                    ...current,
                    [selectedBatchItem.id]: updated.backgroundFill ?? {
                      type: "transparent",
                    },
                  }));
                  documentUiState.setBackgroundDraftDirty(false);
                }}
                onDirtyChange={documentUiState.setBackgroundDraftDirty}
              />
            )}
          </div>
        ) : (
          <div className="grid flex-1 place-items-center min-[56rem]:min-h-56 p-2 text-center">
            <div className="max-w-[14rem]">
              <Images
                className="mx-auto mb-3 size-8 text-muted-foreground/60"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">{m.batchSettingsEmpty()}</p>
            </div>
          </div>
        )}
      </ToolPanelSlot>
    )
  ) : null;

  const batchPersistentMatte =
    batchActive && selectedBatchItem?.processedImage
      ? (originalMatte ?? selectedBatchItem.processedImage.alphaMatte)
      : null;
  const batchCorrecting =
    batchActive && selectedBatchItem?.processedImage && batchPersistentMatte;

  if (batchActive && !batchCorrecting) {
    surfaceNode = batchSurfaceBase;
    railNode = batchRailBase;
  }

  if (!displayError && state.status === "model-loading") {
    surfaceNode = (
      <EditorStage documentId="single-loading" loading>
        <p
          className="rounded-full border border-border bg-background/90 px-4 py-2 font-mono text-sm font-medium text-foreground"
          role="progressbar"
          aria-valuenow={Math.round(state.progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          data-testid="model-loading-skeleton"
        >
          {m.loadingModel({
            mode: modeLabel(state.qualityMode),
            progress: state.progress.toFixed(0),
          })}
        </p>
      </EditorStage>
    );
    railNode = (
      <Skeleton
        className="min-h-[clamp(22rem,62dvh,46rem)] rounded-lg border border-border"
        data-testid="processing-panel-skeleton"
      />
    );
  }

  if (!displayError && (state.status === "ready" || state.status === "processing")) {
    surfaceNode = (
      <EditorStage documentId="single-processing" loading>
        <p
          className="rounded-full border border-border bg-background/90 px-4 py-2 font-mono text-sm font-medium text-foreground"
          data-testid="processing-stage-skeleton"
        >
          {state.status === "processing" ? m.removingBackground() : m.preparing()}
        </p>
      </EditorStage>
    );
    railNode = (
      <Skeleton
        className="min-h-[clamp(22rem,62dvh,46rem)] rounded-lg border border-border"
        data-testid="processing-panel-skeleton"
      />
    );
  }

  if (!displayError && (state.status === "result" || state.status === "correcting")) {
    surfaceNode = (
      <PersistentPreviewLayers
        activeLayer={
          documentUiState.activeTool === "cutout" &&
          documentUiState.cutoutMode === "magic" &&
          guidedCanvas
            ? "magic"
            : "comparison"
        }
        magic={guidedCanvas}
        comparison={
          <BeforeAfterSlider
            before={state.result.source}
            after={state.result.cutout ?? state.result.result}
            backgroundFill={previewFill}
            position={documentUiState.viewPosition}
            onPositionChange={documentUiState.setViewPosition}
          />
        }
      />
    );
    railNode = (
      <ToolPanelSlot
        toolId={documentUiState.activeTool}
        label={tools.find(({ id }) => id === documentUiState.activeTool)?.label ?? ""}
      >
        <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
          {documentUiState.activeTool === "cutout" && (
            <CutoutToolPanel
              mode={documentUiState.cutoutMode}
              onModeChange={selectCutoutMode}
              magicControls={magicControls}
              manualControls={
                <p className="text-sm text-muted-foreground" aria-busy={extractingMatte}>
                  {extractingMatte ? m.preparing() : m.cutoutManualReady()}
                </p>
              }
            />
          )}
          {documentUiState.activeTool === "enhance" && (
            <EnhancementsToolPanel
              registry={enhancementRegistry}
              draft={visibleEnhancementDraft}
              progress={enhancementProgress}
              activeOperationId={enhancementState.activeOperationId}
              outcome={
                enhancementState.documentId === activeDocumentId
                  ? enhancementState.outcome
                  : null
              }
              errorCode={
                enhancementState.documentId === activeDocumentId
                  ? enhancementState.errorCode
                  : null
              }
              onOperationChange={updateEnhancementOperation}
              onApply={applySingleEnhancementDraft}
              onCancel={cancelEnhancementDraft}
              onRetry={retryEnhancements}
            />
          )}
          {documentUiState.activeTool === "background" && (
            <BackgroundToolPanel
              image={{
                source: state.result.source,
                backgroundFill: state.result.backgroundFill,
              }}
              onPreview={(fill) => {
                setPreviewFill(fill);
              }}
              onApply={(fill) => applyBackgroundFill(state.result, fill)}
              onResult={(updated) => {
                commitSingleBackground(updated);
                setPreviewFill(updated.backgroundFill ?? { type: "transparent" });
                documentUiState.setBackgroundDraftDirty(false);
              }}
              onDirtyChange={documentUiState.setBackgroundDraftDirty}
            />
          )}
        </div>
        {correctionError && (
          <CorrectionErrorAlert
            error={correctionError}
            onRetry={handleRetry}
            onReset={handleReset}
          />
        )}
      </ToolPanelSlot>
    );
  }

  // `surface`/`rail` grid content while a mask-correction session is active.
  // `MaskCorrectionSlots` is mounted exactly once here (not once per area —
  // see its own doc comment) and its render-prop builds both grid-area divs
  // in one pass, folding in whatever non-correction content (batch base, the
  // top-level correction error) belongs alongside it.
  let correctionGridBody: ReactNode = null;

  const singlePersistentMatte =
    state.status === "result" || state.status === "correcting"
      ? (originalMatte ?? state.result.alphaMatte)
      : null;

  if (
    !displayError &&
    (state.status === "result" || state.status === "correcting") &&
    singlePersistentMatte
  ) {
    correctionGridBody = (
      <MaskCorrectionSlots
        key={activeDocumentId ?? "single-document"}
        sourceImage={state.result.source}
        originalMatte={singlePersistentMatte}
        backgroundFill={state.result.backgroundFill}
        onDone={handleDoneCorrecting}
        doneDisabled={finalizingCorrection}
        viewportControls={cutoutViewport}
        surfaceTargetRef={manualSurfaceRef}
        onBrushSizeInteraction={() => setManualPreviewKey((current) => current + 1)}
        previewInteractionKey={manualPreviewKey}
        onViewAnnouncementChange={setCorrectionViewAnnouncement}
        onDirtyChange={draftGuard.handleManualDirtyChange}
        interactionMode={documentUiState.interactionMode}
        interactionEnabled={
          documentUiState.activeTool === "cutout" &&
          documentUiState.cutoutMode === "manual"
        }
        draftResetKey={draftGuard.manualDraftResetKey}
        onDecodeError={handleCanvasDecodeError}
        decodeRetryToken={canvasDecodeRetryToken}
      >
        {({ surface, rail }) => (
          <>
            <div className="[grid-area:surface]">
              <EditorStage
                documentId={activeDocumentId ?? "single-correction"}
                overlaySlot={
                  documentUiState.activeTool === "cutout" ? canvasViewControls : undefined
                }
              >
                <PersistentPreviewLayers
                  activeLayer={
                    documentUiState.activeTool === "cutout" &&
                    ((documentUiState.cutoutMode === "magic" && guidedCanvas) ||
                      documentUiState.cutoutMode === "manual")
                      ? documentUiState.cutoutMode
                      : "comparison"
                  }
                  magic={guidedCanvas}
                  manual={surface}
                  comparison={
                    <BeforeAfterSlider
                      before={state.result.source}
                      after={state.result.cutout ?? state.result.result}
                      backgroundFill={previewFill}
                      position={documentUiState.viewPosition}
                      onPositionChange={documentUiState.setViewPosition}
                    />
                  }
                />
              </EditorStage>
            </div>
            <div className="[grid-area:rail]">
              {documentUiState.activeTool === "cutout" ? (
                <ToolPanelSlot toolId="cutout" label={m.editorToolCutout()}>
                  <div className="flex h-full flex-col gap-4">
                    {correctionError && (
                      <CorrectionErrorAlert
                        error={correctionError}
                        onRetry={handleRetry}
                        onReset={handleReset}
                      />
                    )}
                    <CutoutToolPanel
                      mode={documentUiState.cutoutMode}
                      onModeChange={selectCutoutMode}
                      magicControls={magicControls}
                      manualControls={rail}
                    />
                  </div>
                </ToolPanelSlot>
              ) : (
                railNode
              )}
            </div>
          </>
        )}
      </MaskCorrectionSlots>
    );
  } else if (
    batchCorrecting &&
    selectedBatchItem?.processedImage &&
    batchPersistentMatte
  ) {
    correctionGridBody = (
      <MaskCorrectionSlots
        key={activeDocumentId ?? selectedBatchItem.id}
        sourceImage={selectedBatchItem.processedImage.source}
        originalMatte={batchPersistentMatte}
        backgroundFill={selectedBatchItem.processedImage.backgroundFill}
        onDone={handleBatchDoneCorrecting}
        doneDisabled={finalizingCorrection}
        viewportControls={cutoutViewport}
        surfaceTargetRef={manualSurfaceRef}
        onBrushSizeInteraction={() => setManualPreviewKey((current) => current + 1)}
        previewInteractionKey={manualPreviewKey}
        onViewAnnouncementChange={setCorrectionViewAnnouncement}
        onDirtyChange={draftGuard.handleManualDirtyChange}
        interactionMode={documentUiState.interactionMode}
        interactionEnabled={
          documentUiState.activeTool === "cutout" &&
          documentUiState.cutoutMode === "manual"
        }
        draftResetKey={draftGuard.manualDraftResetKey}
        onDecodeError={handleCanvasDecodeError}
        decodeRetryToken={canvasDecodeRetryToken}
      >
        {({ surface, rail }) => (
          <>
            <div className="[grid-area:surface]">
              <EditorStage
                documentId={activeDocumentId ?? "batch-correction"}
                overlaySlot={
                  documentUiState.activeTool === "cutout" ? canvasViewControls : undefined
                }
              >
                <PersistentPreviewLayers
                  activeLayer={
                    documentUiState.activeTool === "cutout" &&
                    ((documentUiState.cutoutMode === "magic" && guidedCanvas) ||
                      documentUiState.cutoutMode === "manual")
                      ? documentUiState.cutoutMode
                      : "comparison"
                  }
                  magic={guidedCanvas}
                  manual={surface}
                  comparison={
                    <BeforeAfterSlider
                      before={selectedBatchItem.processedImage!.source}
                      after={
                        selectedBatchItem.processedImage!.cutout ??
                        selectedBatchItem.processedImage!.result
                      }
                      backgroundFill={
                        batchPreviewFills[selectedBatchItem.id] ??
                        selectedBatchItem.processedImage!.backgroundFill
                      }
                      position={documentUiState.viewPosition}
                      onPositionChange={documentUiState.setViewPosition}
                    />
                  }
                />
              </EditorStage>
            </div>
            <div className="[grid-area:rail]">
              {documentUiState.activeTool === "cutout" ? (
                <ToolPanelSlot toolId="cutout" label={m.editorToolCutout()}>
                  <CutoutToolPanel
                    mode={documentUiState.cutoutMode}
                    onModeChange={selectCutoutMode}
                    magicControls={magicControls}
                    manualControls={rail}
                  />
                </ToolPanelSlot>
              ) : (
                batchRailBase
              )}
            </div>
          </>
        )}
      </MaskCorrectionSlots>
    );
  }

  const activeDownloadDocument =
    selectedBatchItem?.processedImage ??
    (state.status === "result" || state.status === "correcting" ? state.result : null);
  const stagedSurfaceNode =
    activeDocumentId && surfaceNode && !correctionGridBody ? (
      <EditorStage
        documentId={activeDocumentId}
        overlaySlot={
          documentUiState.activeTool === "cutout" && guidedCanvas
            ? canvasViewControls
            : undefined
        }
      >
        {surfaceNode}
      </EditorStage>
    ) : (
      surfaceNode
    );
  const draftGuardNode = draftGuard.draftGuardOpen ? (
    <div
      role="alertdialog"
      aria-labelledby="editor-draft-guard-title"
      aria-describedby="editor-draft-guard-body"
      className="rounded-xl border border-amber-400/60 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100 [grid-area:guard]"
      data-testid="editor-draft-guard"
    >
      <h2 id="editor-draft-guard-title" className="font-semibold">
        {m.editorDraftGuardTitle()}
      </h2>
      <p id="editor-draft-guard-body" className="mt-1">
        {m.editorDraftGuardBody()}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={draftGuard.dismissPendingGuard}>
          {m.editorDraftContinue()}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => window.setTimeout(draftGuard.discardActiveDraft, 50)}
        >
          {m.editorDraftDiscard()}
        </Button>
      </div>
    </div>
  ) : null;
  const showEmptyComposition =
    state.status === "idle" && !batchActive && !guided.state.session;
  const diagnostics = {
    logs,
    runInfo,
    lightweightMode,
    fallbackUsed: ben2FallbackNotice,
    modelLoadBytes,
  };
  const editorToolbarNode = !showEmptyComposition ? (
    <EditorToolbar
      tools={activeDocumentId ? tools : []}
      activeTool={activeDocumentId ? documentUiState.activeTool : null}
      onToolChange={activeDocumentId ? draftGuard.requestTool : undefined}
      canUndo={!draftGuard.activeDraftDirty && historySelectors.canUndo}
      canRedo={!draftGuard.activeDraftDirty && historySelectors.canRedo}
      undoLabel={historySelectors.undoLabel}
      redoLabel={historySelectors.redoLabel}
      onUndo={() => window.setTimeout(handleUndoDocument, 50)}
      onRedo={() => window.setTimeout(handleRedoDocument, 50)}
      statusSlot={
        <LocalExecutionReadout
          busy={busy}
          inferencePath={
            runInfo?.inferencePath ?? deviceCapabilities?.inferencePath ?? null
          }
        />
      }
      workspaceActionsSlot={batchActionsNode}
      downloadSlot={
        (activeDownloadDocument && activeDocumentId) ||
        (batchActive && batch.snapshot.completedCount > 0) ? (
          <DownloadSplitButton
            key={`${activeDocumentId ?? "batch"}:${String(activeEditDocument?.document.revision ?? 0)}`}
            image={activeDownloadDocument?.result}
            source={
              activeDownloadDocument
                ? {
                    width: activeDownloadDocument.source.width,
                    height: activeDownloadDocument.source.height,
                  }
                : undefined
            }
            settings={documentUiState.exportSettings}
            onSettingsChange={
              activeDocumentId ? documentUiState.setExportSettings : undefined
            }
            batchItems={batchActive ? batch.session.items : undefined}
          />
        ) : undefined
      }
      onBack={(trigger) =>
        batchActive
          ? draftGuard.requestBatchClear(trigger)
          : draftGuard.requestReset(trigger)
      }
    />
  ) : null;

  return (
    <>
      {headerUtilityTarget &&
        createPortal(<DiagnosticsSheet {...diagnostics} />, headerUtilityTarget)}
      <div
        data-testid="tool-workspace"
        data-document-id={activeEditDocument?.document.id}
        data-document-revision={activeEditDocument?.document.revision}
        data-document-worker-owner={activeEditDocument?.workerOwnerId}
        data-document-artifact-count={activeEditDocument?.artifacts.stats().artifactCount}
        className={`tool-workspace-grid ${state.status === "idle" && !batchActive ? "tool-workspace-idle" : ""} ${batchActive ? "tool-workspace-batch" : ""} ${guided.state.session ? "tool-workspace-guided" : ""}`}
      >
        <div aria-live="polite" role="status" className="sr-only">
          {enhancementState.status === "applying"
            ? m.enhancementsProgress({
                operation:
                  enhancementRegistry.find(
                    ({ id }) => id === enhancementState.activeOperationId,
                  )?.label ?? m.enhancementsTitle(),
                progress: String(Math.round(enhancementProgress ?? 0)),
              })
            : guided.state.session
              ? describeGuidedState(guided.state.status, guided.state.progress)
              : batch.session.items.length
                ? m.batchCompleteAnnouncement({
                    done: batch.snapshot.completedCount,
                    total: batch.snapshot.totalCount,
                    failed: batch.snapshot.failedCount,
                  })
                : describeState(state, uploadError)}
          {correctionViewAnnouncement ? `. ${correctionViewAnnouncement}.` : ""}
        </div>

        {showEmptyComposition && emptyIntroSlot && (
          <div
            className="[grid-area:intro] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
            data-testid="home-empty-intro"
          >
            {emptyIntroSlot}
          </div>
        )}

        {ben2FallbackNotice && !displayError && (
          <p
            role="status"
            className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 [grid-area:notice]"
          >
            {m.processingFallbackNotice()}
          </p>
        )}

        {displayError && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive [grid-area:error]"
          >
            <p>{verifiedAssetError ? m.modelAssetRecovery() : displayError.message}</p>
            {verifiedAssetError ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleRetry}>
                  {m.tryAgain()}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void clearModelCache().then(retry)}
                >
                  {m.modelAssetResetAndRetry()}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setQualityMode("isnet-q8");
                    retryInLightweightMode();
                  }}
                >
                  {m.modelAssetUseLighter()}
                </Button>
              </div>
            ) : displayError.action === "retry" ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleRetry}
                className="self-start"
              >
                {m.tryAgain()}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="self-start"
              >
                {m.reset()}
              </Button>
            )}
          </div>
        )}

        {editorToolbarNode && (
          <div className="min-w-0 overflow-hidden [grid-area:toolbar] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
            {editorToolbarNode}
          </div>
        )}
        {draftGuardNode}
        {batchListNode && <div className="[grid-area:batch]">{batchListNode}</div>}

        {correctionGridBody ?? (
          <>
            {stagedSurfaceNode && (
              <div className="[grid-area:surface] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
                {stagedSurfaceNode}
              </div>
            )}
            {railNode && (
              <div className="[grid-area:rail] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
                {railNode}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
