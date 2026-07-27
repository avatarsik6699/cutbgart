import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Trash2 } from "lucide-react";

import type {
  AlphaMatte,
  BackgroundFill,
  QualityMode,
  SourceImage,
} from "../../../entities/processed-image";
import { BeforeAfterSlider } from "../../../entities/processed-image";
import {
  MaskCorrectionCanvas,
  MaskCorrectionToolbar,
  useMaskCorrection,
  type MaskCanvasHandle,
} from "../../../features/correct-mask";
import { DownloadResultButton } from "../../../features/download-result";
import { BackgroundFillSelector } from "../../../features/background-replacement";
import { DownloadAllButton } from "../../../features/download-result";
import { BatchGrid, BatchStatus } from "../../../features/batch-processing";
import { QualityModeToggle } from "../../../features/quality-mode-toggle";
import { GuidedBrushCanvas } from "../../../features/select-object";
import { MatteRefinementControls } from "../../../features/refine-matte";
import { ForegroundRefinementControls } from "../../../features/refine-foreground";
import {
  ChoosePhotoButton,
  UploadDropzone,
  UploadPreparationNotice,
  type UploadValidationError,
} from "../../../features/upload-image";
import { Button } from "@/shared/ui";
import { m } from "@/paraglide/messages";
import { clearModelCache } from "@/features/model-storage";
import {
  describeGuidedState,
  describeRefinementState,
  describeState,
} from "../lib/describe-state";
import { useToolWorkspaceController } from "../model/use-tool-workspace-controller";
import {
  createEditorToolRegistry,
  type EditorToolId,
} from "../model/editor-tool-registry";
import { EditorStage } from "./EditorStage";
import { EditorToolbar } from "./EditorToolbar";
import { ProcessingLog } from "./ProcessingLog";

const LazyToolPanelSlot = lazy(async () => {
  const module = await import("./ToolPanelSlot");
  return { default: module.ToolPanelSlot };
});

function ToolPanelSlot(props: import("./ToolPanelSlot").ToolPanelSlotProps) {
  return (
    <Suspense
      fallback={
        <div
          aria-busy="true"
          className="editor-tool-panel min-h-[20rem] animate-pulse rounded-2xl border bg-muted/25 motion-reduce:animate-none sm:min-h-[28rem]"
          data-testid="tool-panel-placeholder"
        />
      }
    >
      <LazyToolPanelSlot {...props} />
    </Suspense>
  );
}

function modeLabel(mode: QualityMode): string {
  if (mode === "max" || mode === "isnet-fp32") return m.processingModePrecise();
  if (mode === "ben2-fp16") return m.processingModeBen2();
  return m.processingModeFast();
}

interface MaskCorrectionSlotsProps {
  sourceImage: SourceImage;
  originalMatte: AlphaMatte;
  backgroundFill?: BackgroundFill;
  onDone: (matte: AlphaMatte) => void;
  doneDisabled?: boolean;
  onViewAnnouncementChange: (announcement: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  children: (slots: { surface: ReactNode; rail: ReactNode }) => ReactNode;
}

/**
 * Composes `features/correct-mask`'s hook + canvas + toolbar into the
 * `correcting` state's UI (Phase 07, SPEC.md §5.2/§5.3). Renders via a
 * children-render-prop so the canvas (visual editing surface) and the
 * toolbar/Done button (control rail) can be placed in different grid areas
 * (Phase 12 F4) while keeping `useMaskCorrection` mounted/unmounted exactly
 * once per correction session, same as before this phase's layout change —
 * hoisting the hook to always-mount would let undo/redo history leak across
 * sessions (docs/KNOWN_GOTCHAS.md R4).
 */
function MaskCorrectionSlots({
  sourceImage,
  originalMatte,
  backgroundFill,
  onDone,
  doneDisabled = false,
  onViewAnnouncementChange,
  onDirtyChange,
  onCancel,
  children,
}: MaskCorrectionSlotsProps) {
  const canvasHandleRef = useRef<MaskCanvasHandle>(null);
  const {
    mode,
    setMode,
    brushSize,
    setBrushSize,
    brushHardness,
    setBrushHardness,
    canUndo,
    canRedo,
    commitStroke,
    undo,
    redo,
    viewport,
    zoomPercent,
    zoomAnnouncement,
    canZoomIn,
    canZoomOut,
    canPan,
    zoomIn,
    zoomOut,
    zoomByWheel,
    resetView,
    panView,
    panBySourcePixels,
  } = useMaskCorrection(canvasHandleRef, {
    width: sourceImage.width,
    height: sourceImage.height,
  });

  useEffect(() => {
    onViewAnnouncementChange(zoomAnnouncement);
    return () => {
      onViewAnnouncementChange("");
    };
  }, [onViewAnnouncementChange, zoomAnnouncement]);

  useEffect(() => {
    onDirtyChange(canUndo);
    return () => onDirtyChange(false);
  }, [canUndo, onDirtyChange]);

  const surface = (
    <MaskCorrectionCanvas
      ref={canvasHandleRef}
      sourceImage={sourceImage}
      backgroundFill={backgroundFill}
      initialMatte={originalMatte}
      original={originalMatte}
      mode={mode}
      brushRadius={brushSize}
      brushHardness={brushHardness}
      viewport={viewport}
      onZoomIn={zoomIn}
      onZoomOut={zoomOut}
      onWheelZoom={zoomByWheel}
      onResetView={resetView}
      onPan={panView}
      onPanBySourcePixels={panBySourcePixels}
      onStrokeCommitted={commitStroke}
    />
  );

  const rail = (
    <div className="flex flex-col gap-4">
      <MaskCorrectionToolbar
        mode={mode}
        onModeChange={setMode}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        brushHardness={brushHardness}
        onBrushHardnessChange={setBrushHardness}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        zoomPercent={zoomPercent}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
        canPan={canPan}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetView={resetView}
      />
      <Button
        type="button"
        disabled={doneDisabled}
        onClick={() => {
          const matte = canvasHandleRef.current?.extractMatte();
          if (matte) onDone(matte);
        }}
        className="self-start"
      >
        {m.done()}
      </Button>
      <Button type="button" variant="outline" onClick={onCancel} className="self-start">
        {m.cancel()}
      </Button>
    </div>
  );

  return children({ surface, rail });
}

type DisplayError = { message: string; action: "retry" | "reset" };

function localizedUploadError(error: UploadValidationError): string {
  if (error.code === "unsupported-format") {
    const format = error.message.match(/"([^"]+)"/)?.[1] ?? "unknown";
    return m.uploadUnsupported({ format });
  }
  if (error.code === "exceeds-size-limit") return m.uploadTooLarge();
  return m.uploadResolutionError();
}

interface CorrectionErrorAlertProps {
  error: DisplayError;
  onRetry: () => void;
  onReset: () => void;
}

function CorrectionErrorAlert({ error, onRetry, onReset }: CorrectionErrorAlertProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
    >
      <p>{error.message}</p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onRetry}>
          {m.tryAgain()}
        </Button>
        <Button type="button" variant="outline" onClick={onReset}>
          {m.reset()}
        </Button>
      </div>
    </div>
  );
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
export function ToolWorkspace() {
  const {
    uploadError,
    preparingFileCount,
    setPreparingFileCount,
    originalMatte,
    extractingMatte,
    finalizingCorrection,
    correctionError,
    correctionViewAnnouncement,
    setCorrectionViewAnnouncement,
    previewFill,
    setPreviewFill,
    backgroundBusy,
    setBackgroundBusy,
    batchPreviewFills,
    setBatchPreviewFills,
    batchBackgroundBusy,
    setBatchBackgroundBusy,
    hydrated,
    guidedVisualContext,
    guided,
    guidedViewSession,
    refinement,
    foregroundRefinement,
    refinementMode,
    setRefinementMode,
    qualityMode,
    setQualityMode,
    state,
    deviceCapabilities,
    lightweightMode,
    runInfo,
    logs,
    modelLoadBytes,
    ben2FallbackNotice,
    recomputeMaxQuality,
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
    handleReset,
    handleAcceptGuided,
    handleGuideAutomaticResult,
    handleGuideBatchResult,
    startSingleRefinement,
    startBatchRefinement,
    startSingleForegroundRefinement,
    startBatchForegroundRefinement,
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
  const activeDocumentId =
    activeEditDocument?.document.id ??
    selectedBatchItem?.id ??
    (state.status === "result" || state.status === "correcting" ? "single-result" : null);
  const [toolByDocument, setToolByDocument] = useState<Record<string, EditorToolId>>({});
  const [viewPositionByDocument, setViewPositionByDocument] = useState<
    Record<string, number>
  >({});
  const [backgroundDraftByDocument, setBackgroundDraftByDocument] = useState<
    Record<string, boolean>
  >({});
  const [manualDraftDirty, setManualDraftDirty] = useState(false);
  const [pendingTool, setPendingTool] = useState<EditorToolId | null>(null);
  const pendingToolTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activeTool = activeDocumentId
    ? (toolByDocument[activeDocumentId] ?? "cutout")
    : "cutout";
  const guidedDraftDirty = Boolean(guided.state.session);
  const manualSessionActive = Boolean(originalMatte);
  const backgroundDraftDirty = activeDocumentId
    ? Boolean(backgroundDraftByDocument[activeDocumentId])
    : false;
  const activeDraftDirty =
    activeTool === "cutout"
      ? guidedDraftDirty || manualSessionActive || manualDraftDirty
      : activeTool === "background" && backgroundDraftDirty;

  const handleManualDirtyChange = useCallback((dirty: boolean) => {
    setManualDraftDirty(dirty);
  }, []);

  function activateTool(tool: EditorToolId) {
    if (!activeDocumentId) return;
    setToolByDocument((current) => ({ ...current, [activeDocumentId]: tool }));
    const definition = tools.find(({ id }) => id === tool);
    if (definition) void definition.loadPanel();
  }

  function requestTool(tool: EditorToolId, trigger: HTMLButtonElement) {
    if (tool === activeTool) return;
    if (activeDraftDirty) {
      pendingToolTriggerRef.current = trigger;
      setPendingTool(tool);
      return;
    }
    activateTool(tool);
  }

  function discardActiveDraft() {
    if (guided.state.session) cancelGuided();
    if (originalMatte) handleCancelCorrection();
    if (activeDocumentId && backgroundDraftDirty) {
      const appliedFill = selectedBatchItem?.processedImage?.backgroundFill ??
        (state.status === "result" || state.status === "correcting"
          ? state.result.backgroundFill
          : undefined) ?? { type: "transparent" };
      if (selectedBatchItem) {
        setBatchPreviewFills((current) => ({
          ...current,
          [selectedBatchItem.id]: appliedFill,
        }));
      } else {
        setPreviewFill(appliedFill);
      }
      setBackgroundDraftByDocument((current) => ({
        ...current,
        [activeDocumentId]: false,
      }));
    }
    setManualDraftDirty(false);
    if (pendingTool) activateTool(pendingTool);
    setPendingTool(null);
    requestAnimationFrame(() => pendingToolTriggerRef.current?.focus());
  }

  const displayError: DisplayError | null = uploadError
    ? { message: localizedUploadError(uploadError), action: "reset" }
    : state.status === "error"
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

  const guidedCanvas =
    guided.state.session && guidedViewSession && guidedVisualContext ? (
      <GuidedBrushCanvas
        session={guidedViewSession}
        status={guided.state.status}
        matteRef={guided.matteRef}
        matteRevision={`${String(guided.state.session.computedRevision ?? "base")}:${guided.state.session.selectedCandidateId ?? "none"}`}
        baseMatteRef={guided.baseMatteRef}
        baseMatteRevision={guided.state.baseMatteRevision}
        entryKind={guidedVisualContext.entryKind}
        resultColorSource={guidedVisualContext.resultColorSource}
        hasMatte={Boolean(guided.state.matte)}
        progress={guided.state.progress}
        error={guided.state.error}
        errorCode={guided.state.errorCode}
        promptCounts={{
          total: guided.state.lastPromptCount,
          keep: guided.state.lastPromptKeepCount,
          remove: guided.state.lastPromptRemoveCount,
        }}
        applying={finalizingCorrection}
        canAccept={guided.canAccept}
        onStroke={guided.addStroke}
        onBrushRadiusChange={guided.setBrushRadius}
        onSelectCandidate={guided.selectCandidate}
        onUndo={guided.undo}
        onRedo={guided.redo}
        onClear={guided.clear}
        onRecompute={guided.recompute}
        onContinueFromResult={guided.continueFromResult}
        onAccept={handleAcceptGuided}
        onRetry={guided.retry}
        onCancel={cancelGuided}
      />
    ) : null;

  if (!displayError && state.status === "idle" && !batch.session.items.length) {
    surfaceNode = guidedCanvas ?? (
      <div className="flex flex-col gap-3">
        <UploadDropzone
          onUpload={handleUpload}
          onUploads={handleUploads}
          onPreparationChange={setPreparingFileCount}
          disabled={!hydrated || busy || preparingFileCount > 0}
        />
        <ChoosePhotoButton
          onUpload={handleUpload}
          onUploads={handleUploads}
          onPreparationChange={setPreparingFileCount}
          disabled={!hydrated || busy || preparingFileCount > 0}
        />
        <UploadPreparationNotice fileCount={preparingFileCount} />
      </div>
    );
  }

  if (!displayError && guidedCanvas) {
    surfaceNode = (
      <div className="flex flex-col gap-4">
        {guidedCanvas}
        {correctionError && (
          <CorrectionErrorAlert
            error={correctionError}
            onRetry={handleRetry}
            onReset={handleReset}
          />
        )}
      </div>
    );
    railNode = null;
  }

  // Batch base content — independent of whether the selected item is
  // currently being mask-corrected. Reused as-is below (no correction) and
  // combined with `MaskCorrectionSlots`' output (correction active).
  const batchActive = !displayError && batch.session.items.length > 0;
  const batchRailBusy = Object.values(batchBackgroundBusy).some(Boolean);
  const batchHeaderNode = batchActive ? (
    <section
      className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
      aria-labelledby="batch-workspace-title"
      data-testid="batch-header"
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="batch-workspace-title" className="text-base font-semibold">
              {m.batchWorkspaceTitle()}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{m.batchWorkspaceHint()}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearBatch}
            className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
            <span className="hidden sm:inline">{m.clearBatch()}</span>
            <span className="sr-only sm:hidden">{m.clearBatch()}</span>
          </Button>
        </div>
        <BatchStatus
          snapshot={batch.snapshot}
          modelLoad={batch.session.modelLoads[batchModelKey]}
        />
        <div className="flex flex-col gap-4 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
          <QualityModeToggle
            qualityMode={qualityMode}
            onQualityModeChange={setQualityMode}
            recommendedMode={
              deviceCapabilities?.inferencePath === "webgpu" ? "isnet-fp32" : "isnet-q8"
            }
            disabled={!hydrated}
          />
          <div
            className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto [&>*]:h-9"
            aria-label={m.batchActionsAria()}
          >
            <ChoosePhotoButton
              onUpload={handleUpload}
              onUploads={handleUploads}
              onPreparationChange={setPreparingFileCount}
              disabled={!hydrated || preparingFileCount > 0}
              batchMode
              label={m.addImages()}
              className="px-4 sm:flex lg:min-w-52"
            />
            <DownloadAllButton
              items={batch.session.items}
              disabled={batchRailBusy}
              className="h-9 px-4 lg:min-w-52"
            />
          </div>
        </div>
      </div>
      <UploadPreparationNotice fileCount={preparingFileCount} />
    </section>
  ) : null;
  const batchListNode = batchActive ? (
    <BatchGrid
      items={batch.session.items}
      selectedItemId={batch.session.selectedItemId}
      onSelect={handleSelectBatchItem}
      onRetry={batch.retryItem}
    />
  ) : null;
  const batchSurfaceBase = batchActive ? (
    <section className="flex flex-col gap-4" aria-labelledby="batch-editor-title">
      <div>
        <h3 id="batch-editor-title" className="text-sm font-semibold">
          {m.batchEditorTitle()}
        </h3>
        {selectedBatchItem && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {selectedBatchItem.originalFileName}
          </p>
        )}
      </div>
      {selectedBatchItem?.processedImage && !originalMatte && (
        <div
          className="flex flex-col gap-4"
          aria-label={m.batchSelectedAria({ name: selectedBatchItem.originalFileName })}
        >
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
            position={
              activeDocumentId ? (viewPositionByDocument[activeDocumentId] ?? 50) : 50
            }
            onPositionChange={(position) => {
              if (!activeDocumentId) return;
              setViewPositionByDocument((current) => ({
                ...current,
                [activeDocumentId]: position,
              }));
            }}
          />
        </div>
      )}
      {!selectedBatchItem && (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {m.batchEditorEmpty()}
        </div>
      )}
    </section>
  ) : null;

  const batchRailBase = batchActive ? (
    <ToolPanelSlot
      toolId={activeTool}
      label={tools.find(({ id }) => id === activeTool)?.label ?? ""}
    >
      {selectedBatchItem?.processedImage && !originalMatte ? (
        <div className="flex flex-col gap-4" data-testid="batch-controls">
          {activeTool === "cutout" && (
            <>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void releaseRefinementBeforeHeavyWork().then(() =>
                      batch.retryItem(selectedBatchItem.id),
                    );
                  }}
                >
                  {m.reprocessMode({
                    mode: modeLabel(selectedBatchItem.qualityMode),
                  })}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBatchEditMask}
                  disabled={extractingMatte || batchBackgroundBusy[selectedBatchItem.id]}
                >
                  {extractingMatte ? m.preparing() : m.editMask()}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleGuideBatchResult}
                  disabled={
                    extractingMatte ||
                    batchBackgroundBusy[selectedBatchItem.id] ||
                    Boolean(batch.snapshot.activeCount || batch.snapshot.queuedCount)
                  }
                >
                  {extractingMatte ? m.preparing() : m.guidedRefineResult()}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {m.batchQualityHint({
                  mode: modeLabel(selectedBatchItem.qualityMode),
                })}
              </p>
            </>
          )}
          {activeTool === "enhance" && (
            <>
              <MatteRefinementControls
                mode={refinementMode}
                path={deviceCapabilities?.inferencePath ?? null}
                status={refinement.state.status}
                progress={refinement.state.progress}
                fallbackReason={refinement.state.fallbackReason}
                fallback={refinement.state.fallback}
                disabled={Boolean(
                  batch.snapshot.activeCount || batch.snapshot.queuedCount,
                )}
                onModeChange={setRefinementMode}
                onStart={() =>
                  startBatchRefinement(
                    selectedBatchItem.id,
                    selectedBatchItem.processedImage!,
                  )
                }
                onCancel={refinement.cancel}
                onSkip={handleBatchEditMask}
              />
              <ForegroundRefinementControls
                status={foregroundRefinement.state.status}
                progress={foregroundRefinement.state.progress}
                fallbackReason={foregroundRefinement.state.fallbackReason}
                result={foregroundRefinement.state.result}
                error={foregroundRefinement.state.error}
                disabled={Boolean(
                  batch.snapshot.activeCount || batch.snapshot.queuedCount,
                )}
                onStart={(componentCleanup) =>
                  startBatchForegroundRefinement(
                    selectedBatchItem.id,
                    selectedBatchItem.processedImage!,
                    componentCleanup,
                  )
                }
                onCancel={foregroundRefinement.cancel}
                onSkip={handleBatchEditMask}
              />
            </>
          )}
          {activeTool === "background" && (
            <BackgroundFillSelector
              image={{
                source: selectedBatchItem.processedImage.source,
                backgroundFill: selectedBatchItem.processedImage.backgroundFill,
              }}
              onPreview={(fill) => {
                setBatchPreviewFills((current) => ({
                  ...current,
                  [selectedBatchItem.id]: fill,
                }));
                if (activeDocumentId)
                  setBackgroundDraftByDocument((current) => ({
                    ...current,
                    [activeDocumentId]: true,
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
                if (activeDocumentId)
                  setBackgroundDraftByDocument((current) => ({
                    ...current,
                    [activeDocumentId]: false,
                  }));
              }}
              onBusyChange={(itemBusy) =>
                setBatchBackgroundBusy((current) => ({
                  ...current,
                  [selectedBatchItem.id]: itemBusy,
                }))
              }
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{m.batchSettingsEmpty()}</p>
      )}
    </ToolPanelSlot>
  ) : null;

  const batchCorrecting =
    batchActive && selectedBatchItem?.processedImage && originalMatte;

  if (batchActive && !batchCorrecting && !guidedCanvas) {
    surfaceNode = batchSurfaceBase;
    railNode = batchRailBase;
  }

  if (!displayError && state.status === "model-loading") {
    surfaceNode = (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {m.loadingModel({
            mode: modeLabel(state.qualityMode),
            progress: state.progress.toFixed(0),
          })}
        </p>
        <div
          role="progressbar"
          aria-valuenow={Math.round(state.progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${String(Math.round(state.progress))}%` }}
          />
        </div>
      </div>
    );
  }

  if (!displayError && (state.status === "ready" || state.status === "processing")) {
    surfaceNode = (
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {state.status === "processing" ? m.removingBackground() : m.preparing()}
        </p>
      </div>
    );
  }

  if (!displayError && state.status === "result" && !guided.state.session) {
    surfaceNode = (
      <BeforeAfterSlider
        before={state.result.source}
        after={state.result.cutout ?? state.result.result}
        backgroundFill={previewFill}
        position={
          activeDocumentId ? (viewPositionByDocument[activeDocumentId] ?? 50) : 50
        }
        onPositionChange={(position) => {
          if (!activeDocumentId) return;
          setViewPositionByDocument((current) => ({
            ...current,
            [activeDocumentId]: position,
          }));
        }}
      />
    );
    railNode = (
      <ToolPanelSlot
        toolId={activeTool}
        label={tools.find(({ id }) => id === activeTool)?.label ?? ""}
      >
        <div className="flex flex-col gap-4">
          {activeTool === "cutout" && (
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={handleReset}>
                {m.processAnother()}
              </Button>
              {state.result.qualityMode !== "max" &&
                state.result.qualityMode !== "isnet-fp32" && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void releaseRefinementBeforeHeavyWork().then(recomputeMaxQuality);
                    }}
                  >
                    {m.recomputeMax()}
                  </Button>
                )}
              <Button
                type="button"
                variant="secondary"
                onClick={handleEditMask}
                disabled={extractingMatte || backgroundBusy}
              >
                {extractingMatte ? m.preparing() : m.editMask()}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleGuideAutomaticResult}
                disabled={extractingMatte || backgroundBusy}
              >
                {extractingMatte ? m.preparing() : m.guidedRefineResult()}
              </Button>
            </div>
          )}
          {activeTool === "enhance" && (
            <>
              <MatteRefinementControls
                mode={refinementMode}
                path={deviceCapabilities?.inferencePath ?? null}
                status={refinement.state.status}
                progress={refinement.state.progress}
                fallbackReason={refinement.state.fallbackReason}
                fallback={refinement.state.fallback}
                onModeChange={setRefinementMode}
                onStart={() => startSingleRefinement(state.result)}
                onCancel={refinement.cancel}
                onSkip={handleEditMask}
              />
              <ForegroundRefinementControls
                status={foregroundRefinement.state.status}
                progress={foregroundRefinement.state.progress}
                fallbackReason={foregroundRefinement.state.fallbackReason}
                result={foregroundRefinement.state.result}
                error={foregroundRefinement.state.error}
                onStart={(componentCleanup) =>
                  startSingleForegroundRefinement(state.result, componentCleanup)
                }
                onCancel={foregroundRefinement.cancel}
                onSkip={handleEditMask}
              />
            </>
          )}
          {activeTool === "background" && (
            <BackgroundFillSelector
              image={{
                source: state.result.source,
                backgroundFill: state.result.backgroundFill,
              }}
              onPreview={(fill) => {
                setPreviewFill(fill);
                if (activeDocumentId)
                  setBackgroundDraftByDocument((current) => ({
                    ...current,
                    [activeDocumentId]: true,
                  }));
              }}
              onApply={(fill) => applyBackgroundFill(state.result, fill)}
              onResult={(updated) => {
                commitSingleBackground(updated);
                setPreviewFill(updated.backgroundFill ?? { type: "transparent" });
                if (activeDocumentId)
                  setBackgroundDraftByDocument((current) => ({
                    ...current,
                    [activeDocumentId]: false,
                  }));
              }}
              onBusyChange={setBackgroundBusy}
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

  if (!displayError && state.status === "correcting" && originalMatte) {
    correctionGridBody = (
      <MaskCorrectionSlots
        sourceImage={state.result.source}
        originalMatte={originalMatte}
        backgroundFill={state.result.backgroundFill}
        onDone={handleDoneCorrecting}
        doneDisabled={finalizingCorrection}
        onViewAnnouncementChange={setCorrectionViewAnnouncement}
        onDirtyChange={handleManualDirtyChange}
        onCancel={handleCancelCorrection}
      >
        {({ surface, rail }) => (
          <>
            <div className="[grid-area:surface]">
              <EditorStage documentId={activeDocumentId ?? "single-correction"}>
                {surface}
              </EditorStage>
            </div>
            <div className="[grid-area:rail]">
              <ToolPanelSlot toolId="cutout" label={m.editorToolCutout()}>
                <div className="flex flex-col gap-4">
                  {correctionError && (
                    <CorrectionErrorAlert
                      error={correctionError}
                      onRetry={handleRetry}
                      onReset={handleReset}
                    />
                  )}
                  {rail}
                </div>
              </ToolPanelSlot>
            </div>
          </>
        )}
      </MaskCorrectionSlots>
    );
  } else if (batchCorrecting && selectedBatchItem?.processedImage && originalMatte) {
    correctionGridBody = (
      <MaskCorrectionSlots
        sourceImage={selectedBatchItem.processedImage.source}
        originalMatte={originalMatte}
        backgroundFill={selectedBatchItem.processedImage.backgroundFill}
        onDone={handleBatchDoneCorrecting}
        doneDisabled={finalizingCorrection}
        onViewAnnouncementChange={setCorrectionViewAnnouncement}
        onDirtyChange={handleManualDirtyChange}
        onCancel={handleCancelCorrection}
      >
        {({ surface, rail }) => (
          <>
            <div className="[grid-area:surface]">
              <EditorStage documentId={activeDocumentId ?? "batch-correction"}>
                {surface}
              </EditorStage>
            </div>
            <div className="[grid-area:rail]">
              <ToolPanelSlot toolId="cutout" label={m.editorToolCutout()}>
                {rail}
              </ToolPanelSlot>
            </div>
          </>
        )}
      </MaskCorrectionSlots>
    );
  }

  if (activeEditDocument && guidedCanvas && !railNode) {
    railNode = (
      <ToolPanelSlot toolId="cutout" label={m.editorToolCutout()}>
        <p className="text-sm text-muted-foreground">{m.editorGuidedAdapterHint()}</p>
      </ToolPanelSlot>
    );
  }

  const activeDownloadImage =
    selectedBatchItem?.processedImage?.result ??
    (state.status === "result" || state.status === "correcting"
      ? state.result.result
      : null);
  const editorToolbarNode = activeDocumentId ? (
    <EditorToolbar
      tools={tools}
      activeTool={activeTool}
      onToolChange={requestTool}
      canUndo={!activeDraftDirty && historySelectors.canUndo}
      canRedo={!activeDraftDirty && historySelectors.canRedo}
      undoLabel={historySelectors.undoLabel}
      redoLabel={historySelectors.redoLabel}
      onUndo={handleUndoDocument}
      onRedo={handleRedoDocument}
      downloadSlot={
        activeDownloadImage ? (
          <DownloadResultButton
            image={activeDownloadImage}
            disabled={
              selectedBatchItem
                ? batchBackgroundBusy[selectedBatchItem.id]
                : backgroundBusy
            }
          />
        ) : undefined
      }
    />
  ) : null;
  const stagedSurfaceNode =
    activeDocumentId && surfaceNode && !correctionGridBody ? (
      <EditorStage documentId={activeDocumentId}>{surfaceNode}</EditorStage>
    ) : (
      surfaceNode
    );
  const draftGuardNode = pendingTool ? (
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
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPendingTool(null);
            requestAnimationFrame(() => pendingToolTriggerRef.current?.focus());
          }}
        >
          {m.editorDraftContinue()}
        </Button>
        <Button type="button" variant="destructive" onClick={discardActiveDraft}>
          {m.editorDraftDiscard()}
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div
      data-testid="tool-workspace"
      data-document-id={activeEditDocument?.document.id}
      data-document-revision={activeEditDocument?.document.revision}
      data-document-worker-owner={activeEditDocument?.workerOwnerId}
      data-document-artifact-count={activeEditDocument?.artifacts.stats().artifactCount}
      className={`tool-workspace-grid ${state.status === "idle" && !batchActive ? "tool-workspace-idle" : ""} ${batchActive ? "tool-workspace-batch" : ""} ${guided.state.session ? "tool-workspace-guided" : ""}`}
    >
      <div aria-live="polite" role="status" className="sr-only">
        {foregroundRefinement.state.status !== "idle" &&
        foregroundRefinement.state.status !== "result"
          ? m.foregroundRefinementProgress({
              progress: String(Math.round(foregroundRefinement.state.progress ?? 0)),
            })
          : refinement.state.status !== "idle" && refinement.state.status !== "result"
            ? describeRefinementState(refinement.state.status, refinement.state.progress)
            : guided.state.session
              ? describeGuidedState(guided.state.status, guided.state.progress)
              : batch.session.items.length
                ? m.batchCompleteAnnouncement({
                    done: batch.snapshot.completedCount,
                    total: batch.snapshot.totalCount,
                    failed: batch.snapshot.failedCount,
                  })
                : describeState(state, uploadError)}
        {state.status === "correcting" && correctionViewAnnouncement
          ? `. ${correctionViewAnnouncement}.`
          : ""}
      </div>

      {!batchActive && !guided.state.session && (
        <div className="[grid-area:toggle]">
          <QualityModeToggle
            qualityMode={qualityMode}
            onQualityModeChange={setQualityMode}
            recommendedMode={
              deviceCapabilities?.inferencePath === "webgpu" ? "isnet-fp32" : "isnet-q8"
            }
            disabled={!hydrated || state.status !== "idle"}
          />
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

      {batchHeaderNode && (
        <div className="[grid-area:batch-header]">{batchHeaderNode}</div>
      )}
      {editorToolbarNode && (
        <div className="[grid-area:toolbar]">{editorToolbarNode}</div>
      )}
      {draftGuardNode}
      {batchListNode && <div className="[grid-area:batch]">{batchListNode}</div>}

      {correctionGridBody ?? (
        <>
          {stagedSurfaceNode && (
            <div className="[grid-area:surface]">{stagedSurfaceNode}</div>
          )}
          {railNode && <div className="[grid-area:rail]">{railNode}</div>}
        </>
      )}

      <div className="[grid-area:log]">
        <ProcessingLog
          logs={logs}
          runInfo={runInfo}
          lightweightMode={lightweightMode}
          fallbackUsed={ben2FallbackNotice}
          modelLoadBytes={modelLoadBytes}
        />
      </div>
    </div>
  );
}
