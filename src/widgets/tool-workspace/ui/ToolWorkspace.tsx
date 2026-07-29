import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

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
  useMaskCorrectionViewport,
  type MaskCanvasHandle,
  type MaskCorrectionViewportControls,
} from "../../../features/correct-mask";
import {
  DEFAULT_EXPORT_SETTINGS,
  DownloadSplitButton,
  type ExportSettings,
} from "../../../features/download-result";
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
  type UploadValidationError,
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
import {
  createEditorToolRegistry,
  type EditorToolId,
} from "../model/editor-tool-registry";
import { EditorStage } from "./EditorStage";
import type { EditorStageFullscreenControls } from "./EditorStage";
import { EditorToolbar } from "./EditorToolbar";
import { BrushSizeStagePreview } from "./BrushSizeStagePreview";
import { BackgroundToolPanel } from "./BackgroundToolPanel";
import { CutoutToolPanel, type CutoutIntent, type CutoutMode } from "./CutoutToolPanel";
import { EnhancementsToolPanel } from "./EnhancementsToolPanel";
import { CanvasViewControls, type CanvasInteractionMode } from "./CanvasViewControls";
import { DiagnosticsSheet } from "./DiagnosticsSheet";
import { ToolPanelSlot } from "./ToolPanelSlot";

function modeLabel(mode: QualityMode): string {
  if (mode === "max" || mode === "isnet-fp32") return m.processingModePrecise();
  if (mode === "ben2-fp16") return m.processingModeBen2();
  return m.processingModeFast();
}

function PersistentPreviewLayers({
  activeLayer,
  comparison,
  magic,
  manual,
}: {
  activeLayer: "comparison" | "magic" | "manual";
  comparison: ReactNode;
  magic?: ReactNode;
  manual?: ReactNode;
}) {
  return (
    <div
      className="relative size-full"
      data-testid="persistent-preview-stack"
      data-active-layer={activeLayer}
    >
      {(
        [
          ["comparison", comparison],
          ["magic", magic],
          ["manual", manual],
        ] as const
      ).map(([name, layer]) =>
        layer ? (
          <div
            key={name}
            className="persistent-preview-layer absolute inset-0 grid size-full place-items-center"
            data-preview-layer={name}
            data-active={activeLayer === name}
            aria-hidden={activeLayer !== name}
          >
            {layer}
          </div>
        ) : null,
      )}
    </div>
  );
}

interface MaskCorrectionSlotsProps {
  sourceImage: SourceImage;
  originalMatte: AlphaMatte;
  backgroundFill?: BackgroundFill;
  onDone: (matte: AlphaMatte) => Promise<boolean>;
  doneDisabled?: boolean;
  viewportControls: MaskCorrectionViewportControls;
  surfaceTargetRef: RefObject<HTMLCanvasElement | null>;
  onBrushSizeInteraction: () => void;
  previewInteractionKey: number;
  onViewAnnouncementChange: (announcement: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  interactionMode: CanvasInteractionMode;
  interactionEnabled: boolean;
  draftResetKey: number;
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
  viewportControls,
  surfaceTargetRef,
  onBrushSizeInteraction,
  previewInteractionKey,
  onViewAnnouncementChange,
  onDirtyChange,
  interactionMode,
  interactionEnabled,
  draftResetKey,
  children,
}: MaskCorrectionSlotsProps) {
  const canvasHandleRef = useRef<MaskCanvasHandle>(null);
  const {
    mode,
    setMode,
    brushSize,
    setBrushSize,
    canUndo,
    commitStroke,
    viewport,
    zoomAnnouncement,
    zoomIn,
    zoomOut,
    zoomByWheel,
    resetView,
    panView,
    panBySourcePixels,
    clearDraft,
    commitDraft,
  } = useMaskCorrection(
    canvasHandleRef,
    {
      width: sourceImage.width,
      height: sourceImage.height,
    },
    viewportControls,
    interactionEnabled,
  );
  const initialDraftResetKeyRef = useRef(draftResetKey);

  useEffect(() => {
    if (draftResetKey === initialDraftResetKeyRef.current) return;
    initialDraftResetKeyRef.current = draftResetKey;
    const timeout = window.setTimeout(clearDraft, 0);
    return () => window.clearTimeout(timeout);
  }, [clearDraft, draftResetKey]);

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

  const ratio = sourceImage.width / sourceImage.height;
  const surface = (
    <div
      className="editor-image-frame relative"
      style={{
        aspectRatio: `${String(sourceImage.width)} / ${String(sourceImage.height)}`,
        width: `min(100cqw, calc(100cqh * ${String(ratio)}))`,
        height: `min(100cqh, calc(100cqw / ${String(ratio)}))`,
      }}
    >
      <MaskCorrectionCanvas
        ref={canvasHandleRef}
        sourceImage={sourceImage}
        backgroundFill={backgroundFill}
        initialMatte={originalMatte}
        original={originalMatte}
        mode={mode}
        brushRadius={brushSize}
        brushHardness={1}
        viewport={viewport}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onWheelZoom={zoomByWheel}
        onResetView={resetView}
        onPan={panView}
        onPanBySourcePixels={panBySourcePixels}
        onStrokeCommitted={commitStroke}
        stageTargetRef={surfaceTargetRef}
        interactionMode={interactionMode}
        interactionEnabled={interactionEnabled}
      />
      <BrushSizeStagePreview
        sourceDiameter={brushSize * 2}
        sourceWidth={sourceImage.width}
        targetRef={surfaceTargetRef}
        interactionKey={previewInteractionKey}
        tone={mode === "erase" ? "erase" : "restore"}
        coreRatio={1 / 3}
      />
    </div>
  );

  const rail = (
    <div className="flex h-full flex-col gap-4">
      <MaskCorrectionToolbar
        mode={mode}
        onModeChange={setMode}
        brushSize={brushSize}
        onBrushSizeChange={(size) => {
          setBrushSize(size);
          onBrushSizeInteraction();
        }}
      />
      <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
        <Button
          type="button"
          disabled={doneDisabled || !canUndo}
          onClick={() => {
            const matte = canvasHandleRef.current?.extractMatte();
            if (matte)
              void onDone(matte).then((committed) => {
                if (committed) commitDraft();
              });
          }}
        >
          {doneDisabled ? m.cutoutApplying() : m.cutoutApply()}
        </Button>
        <Button type="button" variant="outline" onClick={clearDraft}>
          {m.cancel()}
        </Button>
      </div>
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
    handleReset,
    handleApplyGuided,
    handleGuideAutomaticResult,
    handleGuideBatchResult,
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
  const [toolByDocument, setToolByDocument] = useState<Record<string, EditorToolId>>({});
  const [viewPositionByDocument, setViewPositionByDocument] = useState<
    Record<string, number>
  >({});
  const [backgroundDraftByDocument, setBackgroundDraftByDocument] = useState<
    Record<string, boolean>
  >({});
  const [exportSettingsByDocument, setExportSettingsByDocument] = useState<
    Record<string, ExportSettings>
  >({});
  const [cutoutModeByDocument, setCutoutModeByDocument] = useState<
    Record<string, CutoutMode>
  >({});
  const [interactionModeByDocument, setInteractionModeByDocument] = useState<
    Record<string, CanvasInteractionMode>
  >({});
  const [viewControlsCollapsedByDocument, setViewControlsCollapsedByDocument] = useState<
    Record<string, boolean>
  >({});
  const [magicIntent, setMagicIntent] = useState<CutoutIntent>("keep");
  const [magicPreviewKey, setMagicPreviewKey] = useState(0);
  const [manualPreviewKey, setManualPreviewKey] = useState(0);
  const [manualDraftResetKey, setManualDraftResetKey] = useState(0);
  const [manualDraftDirty, setManualDraftDirty] = useState(false);
  const [enhancementDraftByDocument, setEnhancementDraftByDocument] = useState<
    Record<string, EnhancementDraft>
  >({});
  const [pendingTool, setPendingTool] = useState<EditorToolId | null>(null);
  const [pendingBatchItem, setPendingBatchItem] = useState<string | null>(null);
  const [pendingBatchReprocess, setPendingBatchReprocess] = useState<string | null>(null);
  const [pendingBatchRemove, setPendingBatchRemove] = useState<string | null>(null);
  const [pendingBatchClear, setPendingBatchClear] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);
  const pendingToolTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activeTool = activeDocumentId
    ? (toolByDocument[activeDocumentId] ?? "cutout")
    : "cutout";
  const cutoutMode = activeDocumentId
    ? (cutoutModeByDocument[activeDocumentId] ?? "magic")
    : "magic";
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
  const interactionMode = activeDocumentId
    ? (interactionModeByDocument[activeDocumentId] ?? "brush")
    : "brush";
  const magicSurfaceRef = useRef<HTMLCanvasElement>(null);
  const manualSurfaceRef = useRef<HTMLCanvasElement>(null);
  const initializedMagicDocumentRef = useRef<string | null>(null);
  const initializedManualDocumentRef = useRef<string | null>(null);
  const guidedDraftDirty = Boolean(
    guided.state.session?.strokes.length ||
    guided.state.status === "predicting" ||
    finalizingCorrection,
  );
  const backgroundDraftDirty = activeDocumentId
    ? Boolean(backgroundDraftByDocument[activeDocumentId])
    : false;
  const exportSettings = activeDocumentId
    ? (exportSettingsByDocument[activeDocumentId] ?? DEFAULT_EXPORT_SETTINGS)
    : DEFAULT_EXPORT_SETTINGS;
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
  const activeDraftDirty =
    activeTool === "cutout"
      ? guidedDraftDirty || manualDraftDirty
      : activeTool === "enhance"
        ? enhancementDraft.dirty || activeEnhancementStatus !== "idle"
        : activeTool === "background" && backgroundDraftDirty;

  useEffect(() => {
    if (
      !activeDocumentId ||
      activeTool !== "cutout" ||
      cutoutMode !== "magic" ||
      guided.state.session ||
      extractingMatte ||
      initializedMagicDocumentRef.current === activeDocumentId
    )
      return;
    if (selectedBatchItem?.processedImage && selectedBatchItem.status === "result") {
      initializedMagicDocumentRef.current = activeDocumentId;
      handleGuideBatchResult();
    } else if (state.status === "result") {
      initializedMagicDocumentRef.current = activeDocumentId;
      handleGuideAutomaticResult();
    }
    // The controller handlers intentionally capture the current document
    // target; document identity is the effect's lifecycle key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeDocumentId,
    activeTool,
    cutoutMode,
    extractingMatte,
    guided.state.session,
    selectedBatchItem?.id,
    state.status,
  ]);

  useEffect(() => {
    if (
      !activeDocumentId ||
      activeTool !== "cutout" ||
      cutoutMode !== "manual" ||
      originalMatte ||
      extractingMatte ||
      initializedManualDocumentRef.current === activeDocumentId
    )
      return;
    initializedManualDocumentRef.current = activeDocumentId;
    if (selectedBatchItem?.processedImage) handleBatchEditMask();
    else if (state.status === "result") handleEditMask();
    // As above, the active document identity owns this transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeDocumentId,
    activeTool,
    cutoutMode,
    extractingMatte,
    originalMatte,
    selectedBatchItem?.id,
    state.status,
  ]);

  const handleManualDirtyChange = useCallback((dirty: boolean) => {
    setManualDraftDirty(dirty);
  }, []);

  function selectCutoutMode(mode: CutoutMode) {
    if (!activeDocumentId || mode === cutoutMode) return;
    if (mode === "manual" && extractingMatte && !guided.state.session) {
      cancelGuided();
    } else if (mode === "magic" && extractingMatte && !originalMatte) {
      handleCancelCorrection();
    }
    setCutoutModeByDocument((current) => ({
      ...current,
      [activeDocumentId]: mode,
    }));
  }

  function activateTool(tool: EditorToolId) {
    if (!activeDocumentId) return;
    setToolByDocument((current) => ({ ...current, [activeDocumentId]: tool }));
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

  function requestBatchItem(id: string, trigger: HTMLButtonElement) {
    if (id === batch.session.selectedItemId) return;
    if (activeDraftDirty) {
      pendingToolTriggerRef.current = trigger;
      setPendingBatchItem(id);
      return;
    }
    handleSelectBatchItem(id);
  }

  function prepareActiveBatchMutation(id: string) {
    if (id !== batch.session.selectedItemId) return;
    if (guided.state.session) cancelGuided();
    if (originalMatte) handleCancelCorrection();
    initializedMagicDocumentRef.current = null;
    initializedManualDocumentRef.current = null;
    setManualDraftDirty(false);
  }

  function executeBatchReprocess(id: string) {
    prepareActiveBatchMutation(id);
    void releaseRefinementBeforeHeavyWork().then(() => batch.retryItem(id));
  }

  function requestBatchReprocess(id: string, trigger: HTMLButtonElement) {
    if (id === batch.session.selectedItemId && activeDraftDirty) {
      pendingToolTriggerRef.current = trigger;
      setPendingBatchReprocess(id);
      return;
    }
    executeBatchReprocess(id);
  }

  function executeBatchRemove(id: string) {
    prepareActiveBatchMutation(id);
    batch.removeItem(id);
  }

  function requestBatchRemove(id: string, trigger: HTMLButtonElement) {
    if (id === batch.session.selectedItemId && activeDraftDirty) {
      pendingToolTriggerRef.current = trigger;
      setPendingBatchRemove(id);
      return;
    }
    executeBatchRemove(id);
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

  function requestBatchClear(trigger: HTMLButtonElement) {
    if (activeDraftDirty) {
      pendingToolTriggerRef.current = trigger;
      setPendingBatchClear(true);
      return;
    }
    handleClearBatch();
  }

  function requestReset(trigger: HTMLButtonElement) {
    if (activeDraftDirty) {
      pendingToolTriggerRef.current = trigger;
      setPendingReset(true);
      return;
    }
    handleReset();
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
    if (!activeDocumentId) return;
    setEnhancementDraftByDocument((current) => ({
      ...current,
      [activeDocumentId]: defaultEnhancementDraft,
    }));
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

  function clearActiveDraftState() {
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
    if (activeDocumentId && activeTool === "enhance") {
      cancelEnhancements();
      setEnhancementDraftByDocument((current) => ({
        ...current,
        [activeDocumentId]: defaultEnhancementDraft,
      }));
    }
    if (manualDraftDirty) setManualDraftResetKey((current) => current + 1);
    setManualDraftDirty(false);
  }

  function discardActiveDraft() {
    if (pendingTool) {
      const nextTool = pendingTool;
      activateTool(nextTool);
      setManualDraftDirty(false);
      setPendingTool(null);
      setPendingBatchItem(null);
      setPendingBatchReprocess(null);
      setPendingBatchRemove(null);
      setPendingBatchClear(false);
      setPendingReset(false);
      requestAnimationFrame(() => pendingToolTriggerRef.current?.focus());
      window.setTimeout(clearActiveDraftState, 100);
      return;
    }
    clearActiveDraftState();
    if (pendingTool) activateTool(pendingTool);
    else if (pendingBatchItem) handleSelectBatchItem(pendingBatchItem);
    else if (pendingBatchReprocess) executeBatchReprocess(pendingBatchReprocess);
    else if (pendingBatchRemove) executeBatchRemove(pendingBatchRemove);
    else if (pendingBatchClear) handleClearBatch();
    else if (pendingReset) handleReset();
    setPendingTool(null);
    setPendingBatchItem(null);
    setPendingBatchReprocess(null);
    setPendingBatchRemove(null);
    setPendingBatchClear(false);
    setPendingReset(false);
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

  const canvasViewControls = activeDocumentId
    ? ({ expanded, toggleFullscreen }: EditorStageFullscreenControls) => (
        <CanvasViewControls
          interactionMode={interactionMode}
          onInteractionModeChange={(mode) =>
            setInteractionModeByDocument((current) => ({
              ...current,
              [activeDocumentId]: mode,
            }))
          }
          zoomPercent={cutoutViewport.zoomPercent}
          canZoomIn={cutoutViewport.canZoomIn}
          canZoomOut={cutoutViewport.canZoomOut}
          canPan={cutoutViewport.canPan}
          onZoomIn={cutoutViewport.zoomIn}
          onZoomOut={() => {
            cutoutViewport.zoomOut();
            if (cutoutViewport.zoomPercent <= 125)
              setInteractionModeByDocument((current) => ({
                ...current,
                [activeDocumentId]: "brush",
              }));
          }}
          onResetView={() => {
            cutoutViewport.resetView();
            setInteractionModeByDocument((current) => ({
              ...current,
              [activeDocumentId]: "brush",
            }));
          }}
          expanded={expanded}
          onToggleFullscreen={toggleFullscreen}
          collapsed={Boolean(viewControlsCollapsedByDocument[activeDocumentId])}
          onCollapsedChange={(collapsed) =>
            setViewControlsCollapsedByDocument((current) => ({
              ...current,
              [activeDocumentId]: collapsed,
            }))
          }
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
          active={activeTool === "cutout" && cutoutMode === "magic"}
          mode={magicIntent}
          viewportControls={cutoutViewport}
          interactionMode={interactionMode}
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
        applying={finalizingCorrection}
        canApply={guided.canApply}
        onBrushRadiusChange={guided.setBrushRadius}
        onBrushSizeInteraction={() => setMagicPreviewKey((current) => current + 1)}
        onApply={() => void handleApplyGuided()}
        onCancel={guided.cancelDraft}
      />
    ) : (
      <p className="text-sm text-muted-foreground" aria-busy={extractingMatte}>
        {extractingMatte ? m.preparing() : m.cutoutMagicReady()}
      </p>
    );

  if (!displayError && state.status === "idle" && !batch.session.items.length) {
    surfaceNode = guidedCanvas ?? (
      <section className="command-deck relative isolate flex min-h-[30rem] flex-col justify-center gap-5 overflow-hidden px-1 py-5 sm:px-3 sm:py-7">
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
          recommendedMode={
            deviceCapabilities?.inferencePath === "webgpu" ? "isnet-fp32" : "isnet-q8"
          }
          disabled={!hydrated}
        />
        <UploadDropzone
          onUpload={handleUpload}
          onUploads={handleUploads}
          onPreparationChange={setPreparingFileCount}
          disabled={!hydrated || busy || preparingFileCount > 0}
          className="command-deck-dropzone border border-border/80 bg-background/50 shadow-[0_18px_70px_-55px_var(--foreground)] backdrop-blur-sm"
        />
        <ChoosePhotoButton
          onUpload={handleUpload}
          onUploads={handleUploads}
          onPreparationChange={setPreparingFileCount}
          disabled={!hydrated || busy || preparingFileCount > 0}
        />
        <UploadPreparationNotice fileCount={preparingFileCount} />
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
        recommendedMode={
          deviceCapabilities?.inferencePath === "webgpu" ? "isnet-fp32" : "isnet-q8"
        }
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
    <BatchGrid
      items={batch.session.items}
      selectedItemId={batch.session.selectedItemId}
      snapshot={batch.snapshot}
      modelLoad={batch.session.modelLoads[batchModelKey]}
      onSelect={requestBatchItem}
      onDownload={downloadBatchItem}
      onRetry={requestBatchReprocess}
      onRemove={requestBatchRemove}
    />
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
              activeTool === "cutout" && cutoutMode === "magic" && guidedCanvas
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
            }
          />
        </div>
      )}
      {!selectedBatchItem?.processedImage && (
        <div className="grid size-full place-items-center rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          <div className="max-w-xs">
            <Skeleton className="mx-auto mb-4 h-36 w-48 rounded-xl" aria-hidden="true" />
            <p>{m.batchEditorEmpty()}</p>
          </div>
        </div>
      )}
    </section>
  ) : null;

  const batchRailBase = batchActive ? (
    <ToolPanelSlot
      toolId={activeTool}
      label={tools.find(({ id }) => id === activeTool)?.label ?? ""}
    >
      {selectedBatchItem?.processedImage ? (
        <div className="flex flex-col gap-4" data-testid="batch-controls">
          {activeTool === "cutout" && (
            <CutoutToolPanel
              mode={cutoutMode}
              onModeChange={selectCutoutMode}
              magicControls={magicControls}
              manualControls={
                <p className="text-sm text-muted-foreground" aria-busy={extractingMatte}>
                  {extractingMatte ? m.preparing() : m.cutoutManualReady()}
                </p>
              }
            />
          )}
          {activeTool === "enhance" && (
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
              disabled={Boolean(batch.snapshot.activeCount || batch.snapshot.queuedCount)}
              onOperationChange={updateEnhancementOperation}
              onApply={applyBatchEnhancementDraft}
              onCancel={cancelEnhancementDraft}
              onRetry={retryEnhancements}
            />
          )}
          {activeTool === "background" && (
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
                if (activeDocumentId)
                  setBackgroundDraftByDocument((current) => ({
                    ...current,
                    [activeDocumentId]: false,
                  }));
              }}
              onDirtyChange={(dirty) => {
                if (!activeDocumentId) return;
                setBackgroundDraftByDocument((current) => ({
                  ...current,
                  [activeDocumentId]: dirty,
                }));
              }}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{m.batchSettingsEmpty()}</p>
      )}
    </ToolPanelSlot>
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
          className="rounded-full border bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-sm"
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
        className="min-h-[clamp(22rem,62dvh,46rem)] rounded-2xl border"
        data-testid="processing-panel-skeleton"
      />
    );
  }

  if (!displayError && (state.status === "ready" || state.status === "processing")) {
    surfaceNode = (
      <EditorStage documentId="single-processing" loading>
        <p
          className="rounded-full border bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-sm"
          data-testid="processing-stage-skeleton"
        >
          {state.status === "processing" ? m.removingBackground() : m.preparing()}
        </p>
      </EditorStage>
    );
    railNode = (
      <Skeleton
        className="min-h-[clamp(22rem,62dvh,46rem)] rounded-2xl border"
        data-testid="processing-panel-skeleton"
      />
    );
  }

  if (!displayError && (state.status === "result" || state.status === "correcting")) {
    surfaceNode = (
      <PersistentPreviewLayers
        activeLayer={
          activeTool === "cutout" && cutoutMode === "magic" && guidedCanvas
            ? "magic"
            : "comparison"
        }
        magic={guidedCanvas}
        comparison={
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
        }
      />
    );
    railNode = (
      <ToolPanelSlot
        toolId={activeTool}
        label={tools.find(({ id }) => id === activeTool)?.label ?? ""}
      >
        <div className="flex flex-col gap-4">
          {activeTool === "cutout" && (
            <CutoutToolPanel
              mode={cutoutMode}
              onModeChange={selectCutoutMode}
              magicControls={magicControls}
              manualControls={
                <p className="text-sm text-muted-foreground" aria-busy={extractingMatte}>
                  {extractingMatte ? m.preparing() : m.cutoutManualReady()}
                </p>
              }
            />
          )}
          {activeTool === "enhance" && (
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
          {activeTool === "background" && (
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
                if (activeDocumentId)
                  setBackgroundDraftByDocument((current) => ({
                    ...current,
                    [activeDocumentId]: false,
                  }));
              }}
              onDirtyChange={(dirty) => {
                if (!activeDocumentId) return;
                setBackgroundDraftByDocument((current) => ({
                  ...current,
                  [activeDocumentId]: dirty,
                }));
              }}
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
        onDirtyChange={handleManualDirtyChange}
        interactionMode={interactionMode}
        interactionEnabled={activeTool === "cutout" && cutoutMode === "manual"}
        draftResetKey={manualDraftResetKey}
      >
        {({ surface, rail }) => (
          <>
            <div className="[grid-area:surface]">
              <EditorStage
                documentId={activeDocumentId ?? "single-correction"}
                overlaySlot={canvasViewControls}
              >
                <PersistentPreviewLayers
                  activeLayer={
                    activeTool === "cutout" &&
                    ((cutoutMode === "magic" && guidedCanvas) || cutoutMode === "manual")
                      ? cutoutMode
                      : "comparison"
                  }
                  magic={guidedCanvas}
                  manual={surface}
                  comparison={
                    <BeforeAfterSlider
                      before={state.result.source}
                      after={state.result.cutout ?? state.result.result}
                      backgroundFill={previewFill}
                      position={
                        activeDocumentId
                          ? (viewPositionByDocument[activeDocumentId] ?? 50)
                          : 50
                      }
                      onPositionChange={(position) => {
                        if (!activeDocumentId) return;
                        setViewPositionByDocument((current) => ({
                          ...current,
                          [activeDocumentId]: position,
                        }));
                      }}
                    />
                  }
                />
              </EditorStage>
            </div>
            <div className="[grid-area:rail]">
              {activeTool === "cutout" ? (
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
                      mode={cutoutMode}
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
        onDirtyChange={handleManualDirtyChange}
        interactionMode={interactionMode}
        interactionEnabled={activeTool === "cutout" && cutoutMode === "manual"}
        draftResetKey={manualDraftResetKey}
      >
        {({ surface, rail }) => (
          <>
            <div className="[grid-area:surface]">
              <EditorStage
                documentId={activeDocumentId ?? "batch-correction"}
                overlaySlot={canvasViewControls}
              >
                <PersistentPreviewLayers
                  activeLayer={
                    activeTool === "cutout" &&
                    ((cutoutMode === "magic" && guidedCanvas) || cutoutMode === "manual")
                      ? cutoutMode
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
                      position={
                        activeDocumentId
                          ? (viewPositionByDocument[activeDocumentId] ?? 50)
                          : 50
                      }
                      onPositionChange={(position) => {
                        if (!activeDocumentId) return;
                        setViewPositionByDocument((current) => ({
                          ...current,
                          [activeDocumentId]: position,
                        }));
                      }}
                    />
                  }
                />
              </EditorStage>
            </div>
            <div className="[grid-area:rail]">
              {activeTool === "cutout" ? (
                <ToolPanelSlot toolId="cutout" label={m.editorToolCutout()}>
                  <CutoutToolPanel
                    mode={cutoutMode}
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
          activeTool === "cutout" && guidedCanvas ? canvasViewControls : undefined
        }
      >
        {surfaceNode}
      </EditorStage>
    ) : (
      surfaceNode
    );
  const draftGuardOpen = Boolean(
    pendingTool ||
    pendingBatchItem ||
    pendingBatchReprocess ||
    pendingBatchRemove ||
    pendingBatchClear ||
    pendingReset,
  );
  const draftGuardNode = draftGuardOpen ? (
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
            setPendingBatchItem(null);
            setPendingBatchReprocess(null);
            setPendingBatchRemove(null);
            setPendingBatchClear(false);
            setPendingReset(false);
            requestAnimationFrame(() => pendingToolTriggerRef.current?.focus());
          }}
        >
          {m.editorDraftContinue()}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => window.setTimeout(discardActiveDraft, 50)}
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
      activeTool={activeDocumentId ? activeTool : null}
      onToolChange={activeDocumentId ? requestTool : undefined}
      canUndo={!activeDraftDirty && historySelectors.canUndo}
      canRedo={!activeDraftDirty && historySelectors.canRedo}
      undoLabel={historySelectors.undoLabel}
      redoLabel={historySelectors.redoLabel}
      onUndo={() => window.setTimeout(handleUndoDocument, 50)}
      onRedo={() => window.setTimeout(handleRedoDocument, 50)}
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
            settings={exportSettings}
            onSettingsChange={
              activeDocumentId
                ? (nextSettings) => {
                    setExportSettingsByDocument((current) => ({
                      ...current,
                      [activeDocumentId]: nextSettings,
                    }));
                  }
                : undefined
            }
            batchItems={batchActive ? batch.session.items : undefined}
          />
        ) : undefined
      }
      onBack={(trigger) =>
        batchActive ? requestBatchClear(trigger) : requestReset(trigger)
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
          {state.status === "correcting" && correctionViewAnnouncement
            ? `. ${correctionViewAnnouncement}.`
            : ""}
        </div>

        {showEmptyComposition && emptyIntroSlot && (
          <div className="[grid-area:intro]" data-testid="home-empty-intro">
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
          <div className="min-w-0 overflow-hidden [grid-area:toolbar]">
            {editorToolbarNode}
          </div>
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
      </div>
    </>
  );
}
