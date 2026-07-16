import { useEffect, useRef, useState, type ReactNode } from "react";
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
import {
  BatchGrid,
  BatchStatus,
  useBatchProcessing,
} from "../../../features/batch-processing";
import {
  detectDeviceCapabilities,
  useBackgroundRemoval,
} from "../../../features/remove-background";
import { QualityModeToggle, useQualityMode } from "../../../features/quality-mode-toggle";
import {
  ObjectSelectionCanvas,
  useObjectSelection,
} from "../../../features/select-object";
import {
  ChoosePhotoButton,
  UploadDropzone,
  UploadPreparationNotice,
  type UploadResult,
  type UploadValidationError,
} from "../../../features/upload-image";
import { Button } from "@/shared/ui";
import { m } from "@/paraglide/messages";
import { describeGuidedState, describeState } from "../lib/describe-state";
import { sourceImageToFile } from "../lib/source-image-to-file";
import { ProcessingLog } from "./ProcessingLog";

function pathLabel(path: "webgpu" | "wasm"): string {
  return path === "webgpu" ? "WebGPU" : "WASM";
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
  const [defaultQualityMode, setDefaultQualityMode] = useState<QualityMode>("fast");
  const [uploadError, setUploadError] = useState<UploadValidationError | null>(null);
  const [preparingFileCount, setPreparingFileCount] = useState(0);
  const [originalMatte, setOriginalMatte] = useState<AlphaMatte | null>(null);
  const [extractingMatte, setExtractingMatte] = useState(false);
  const [finalizingCorrection, setFinalizingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<DisplayError | null>(null);
  const [correctionViewAnnouncement, setCorrectionViewAnnouncement] = useState("");
  const [previewFill, setPreviewFill] = useState<BackgroundFill>({ type: "transparent" });
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [batchPreviewFills, setBatchPreviewFills] = useState<
    Record<string, BackgroundFill>
  >({});
  const [batchBackgroundBusy, setBatchBackgroundBusy] = useState<Record<string, boolean>>(
    {},
  );
  const retryCorrectionRef = useRef<(() => void) | null>(null);
  const correctionRunRef = useRef(0);
  // TanStack Start SSRs this widget's markup before client hydration attaches
  // `UploadDropzone`/`ChoosePhotoButton`'s onChange/onDrop handlers — a real
  // interaction in that window is visually indistinguishable from a working
  // control but silently drops the event (same class of bug as
  // docs/KNOWN_GOTCHAS.md's Playwright-hydration-race entry, but reproducible
  // by a real user's very first upload attempt, not just automation). `false`
  // on both the server render and the first client render, flipping to `true`
  // only once this effect actually runs — i.e. only once hydration has
  // completed and the upload controls' own handlers are live.
  const [hydrated, setHydrated] = useState(false);
  const [guidedEntry, setGuidedEntry] = useState(false);
  const guided = useObjectSelection();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate hydration flag (see comment above): it must flip exactly once, only after hydration completes on the client; the one extra render is the point, not an accident.
    setHydrated(true);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void detectDeviceCapabilities().then((capabilities) => {
      if (!cancelled) setDefaultQualityMode(capabilities.defaultQualityMode);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { qualityMode, setQualityMode } = useQualityMode(defaultQualityMode);
  const {
    state,
    deviceCapabilities,
    lightweightMode,
    runInfo,
    logs,
    modelLoadBytes,
    ben2FallbackNotice,
    selectFile,
    recomputeMaxQuality,
    retry,
    reset,
    enterCorrecting,
    exitCorrecting,
    extractMatte,
    recomposite,
    applyBackgroundFill,
    replaceResult,
    adoptResult,
  } = useBackgroundRemoval(qualityMode);
  const batch = useBatchProcessing({
    qualityMode,
    inferencePath: deviceCapabilities?.inferencePath ?? "wasm",
    concurrencyLimit:
      qualityMode === "ben2-fp16"
        ? 1
        : deviceCapabilities?.inferencePath === "webgpu"
          ? 2
          : 1,
  });
  const batchModelKey =
    `${qualityMode}:${deviceCapabilities?.inferencePath ?? "wasm"}` as const;
  const selectedBatchItem = batch.session.items.find(
    (item) => item.id === batch.session.selectedItemId,
  );
  const lastLogMessage = logs.at(-1)?.message;

  function handleUpload(result: UploadResult) {
    correctionRunRef.current += 1;
    setCorrectionError(null);
    setCorrectionViewAnnouncement("");
    retryCorrectionRef.current = null;
    setPreviewFill({ type: "transparent" });
    setBackgroundBusy(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    setUploadError(null);
    if (guidedEntry) guided.start(result.image);
    else selectFile(sourceImageToFile(result.image));
  }

  function handleUploads(results: Array<{ fileName: string; result: UploadResult }>) {
    const valid = results.flatMap(({ fileName, result }) =>
      result.ok ? [{ fileName, source: result.image }] : [],
    );
    const invalid = results.find(({ result }) => !result.ok);
    setUploadError(invalid && !invalid.result.ok ? invalid.result.error : null);
    if (valid.length) batch.enqueue(valid);
  }

  function handleReset() {
    correctionRunRef.current += 1;
    setUploadError(null);
    setPreparingFileCount(0);
    setCorrectionError(null);
    setCorrectionViewAnnouncement("");
    retryCorrectionRef.current = null;
    setOriginalMatte(null);
    setExtractingMatte(false);
    setFinalizingCorrection(false);
    setPreviewFill({ type: "transparent" });
    setBackgroundBusy(false);
    setGuidedEntry(false);
    guided.reset();
    reset();
  }

  function handleAcceptGuided() {
    const session = guided.state.session;
    if (!session || !guided.state.matte) return;
    const seed =
      state.status === "result"
        ? state.result
        : {
            source: session.source,
            result: session.source.blob,
            qualityMode: "isnet-q8" as const,
            alphaMatte: guided.state.matte,
            backgroundFill: { type: "transparent" as const },
          };
    setFinalizingCorrection(true);
    void recomposite(seed, guided.state.matte)
      .then((result) => {
        setFinalizingCorrection(false);
        setOriginalMatte(guided.state.matte);
        adoptResult(result);
        enterCorrecting();
        guided.reset();
        setGuidedEntry(false);
      })
      .catch((error: unknown) => {
        setFinalizingCorrection(false);
        setCorrectionError({
          message: error instanceof Error ? error.message : String(error),
          action: "retry",
        });
      });
  }

  function handleGuideAutomaticResult() {
    if (state.status !== "result") return;
    setExtractingMatte(true);
    void extractMatte(state.result)
      .then((matte) => {
        setExtractingMatte(false);
        guided.start(state.result.source, matte);
      })
      .catch((error: unknown) => {
        setExtractingMatte(false);
        setCorrectionError({
          message: error instanceof Error ? error.message : String(error),
          action: "retry",
        });
      });
  }

  function handleRetry() {
    if (correctionError && retryCorrectionRef.current) {
      retryCorrectionRef.current();
      return;
    }
    retry();
  }

  function handleEditMask() {
    if (state.status !== "result") return;
    const image = state.result;
    const runId = correctionRunRef.current + 1;
    correctionRunRef.current = runId;
    retryCorrectionRef.current = () => {
      if (state.status === "result") handleEditMask();
    };
    setCorrectionError(null);
    setExtractingMatte(true);
    void extractMatte(image)
      .then((matte) => {
        if (correctionRunRef.current !== runId) return;
        setExtractingMatte(false);
        setOriginalMatte(matte);
        retryCorrectionRef.current = null;
        enterCorrecting();
      })
      .catch((error: unknown) => {
        if (correctionRunRef.current !== runId) return;
        setExtractingMatte(false);
        setCorrectionError({
          message: `Could not prepare mask editor: ${error instanceof Error ? error.message : String(error)}`,
          action: "retry",
        });
      });
  }

  function handleBatchEditMask() {
    if (!selectedBatchItem?.processedImage) return;
    const image = selectedBatchItem.processedImage;
    const runId = correctionRunRef.current + 1;
    correctionRunRef.current = runId;
    setExtractingMatte(true);
    void batch
      .extractMatte(image)
      .then((matte) => {
        // The user may have selected a different batch item while this
        // extraction was in flight — applying it now would seed the mask
        // editor with a matte whose dimensions don't match the now-selected
        // image's source. `handleSelectBatchItem` bumps `correctionRunRef`
        // on every switch, so a stale run is simply dropped here.
        if (correctionRunRef.current !== runId) return;
        setExtractingMatte(false);
        setOriginalMatte(matte);
      })
      .catch((error: unknown) => {
        if (correctionRunRef.current !== runId) return;
        setExtractingMatte(false);
        setCorrectionError({
          message: `Could not prepare mask editor: ${error instanceof Error ? error.message : String(error)}`,
          action: "retry",
        });
      });
  }

  function handleSelectBatchItem(id: string) {
    if (id !== batch.session.selectedItemId) {
      // Clear any in-progress correction state from the previously selected
      // item — otherwise a stale `originalMatte` (wrong dimensions for the
      // newly selected image) or a stale extraction/error can leak across
      // the switch. Bumping `correctionRunRef` also invalidates any
      // in-flight `extractMatte` from the item being switched away from.
      correctionRunRef.current += 1;
      setCorrectionError(null);
      setExtractingMatte(false);
      setOriginalMatte(null);
      setCorrectionViewAnnouncement("");
    }
    batch.selectItem(id);
  }

  function handleBatchDoneCorrecting(correctedMatte: AlphaMatte) {
    if (!selectedBatchItem?.processedImage) return;
    const image = selectedBatchItem.processedImage;
    setFinalizingCorrection(true);
    void batch
      .recomposite(image, correctedMatte)
      .then((updated) => {
        setFinalizingCorrection(false);
        setOriginalMatte(null);
        batch.replaceResult(selectedBatchItem.id, updated);
      })
      .catch((error: unknown) => {
        setFinalizingCorrection(false);
        setCorrectionError({
          message: `Could not apply mask correction: ${error instanceof Error ? error.message : String(error)}`,
          action: "retry",
        });
      });
  }

  function handleDoneCorrecting(correctedMatte: AlphaMatte) {
    if (state.status !== "correcting") return;
    const image = state.result;
    const runId = correctionRunRef.current + 1;
    correctionRunRef.current = runId;
    retryCorrectionRef.current = () => {
      if (state.status === "correcting") handleDoneCorrecting(correctedMatte);
    };
    setCorrectionError(null);
    setFinalizingCorrection(true);
    void recomposite(image, correctedMatte)
      .then((updated) => {
        if (correctionRunRef.current !== runId) return;
        setFinalizingCorrection(false);
        setOriginalMatte(null);
        retryCorrectionRef.current = null;
        exitCorrecting(updated);
      })
      .catch((error: unknown) => {
        if (correctionRunRef.current !== runId) return;
        setFinalizingCorrection(false);
        setCorrectionError({
          message: `Could not apply mask correction: ${error instanceof Error ? error.message : String(error)}`,
          action: "retry",
        });
      });
  }

  const busy = state.status === "model-loading" || state.status === "processing";

  const displayError: DisplayError | null = uploadError
    ? { message: localizedUploadError(uploadError), action: "reset" }
    : state.status === "error"
      ? { message: state.error.message, action: state.error.action }
      : null;

  // Two grid slots (`.tool-workspace-grid`, globals.css): `surface` is the
  // visual/preview area (upload UI, batch grid, before/after slider, mask
  // canvas), `rail` is the control area next to it (background-fill picker,
  // action buttons, mask toolbar). Exactly one state block populates them
  // per render — see the `state.status` branches below.
  let surfaceNode: ReactNode = null;
  let railNode: ReactNode = null;

  const guidedCanvas = guided.state.session ? (
    <ObjectSelectionCanvas
      session={guided.state.session}
      status={guided.state.status}
      matteRef={guided.matteRef}
      matteRevision={guided.state.session.revision}
      hasMatte={Boolean(guided.state.matte)}
      progress={guided.state.progress}
      error={guided.state.error}
      onPoint={guided.addPoint}
      onBox={guided.setBox}
      onStroke={guided.addStroke}
      onAddLayer={guided.addLayer}
      onSelectLayer={guided.selectLayer}
      onRemoveLayer={guided.removeLayer}
      onSelectCandidate={guided.selectCandidate}
      onUndo={guided.undo}
      onRedo={guided.redo}
      onResetLayer={guided.resetLayer}
      onAccept={handleAcceptGuided}
      onRetry={guided.retry}
      onCancel={() => {
        guided.reset();
        setGuidedEntry(false);
      }}
    />
  ) : null;

  if (!displayError && state.status === "idle" && !batch.session.items.length) {
    surfaceNode = guidedCanvas ?? (
      <div className="flex flex-col gap-3">
        <UploadDropzone
          onUpload={handleUpload}
          onUploads={guidedEntry ? undefined : handleUploads}
          onPreparationChange={setPreparingFileCount}
          disabled={!hydrated || busy || preparingFileCount > 0}
        />
        <ChoosePhotoButton
          onUpload={handleUpload}
          onUploads={guidedEntry ? undefined : handleUploads}
          onPreparationChange={setPreparingFileCount}
          disabled={!hydrated || busy || preparingFileCount > 0}
        />
        <UploadPreparationNotice fileCount={preparingFileCount} />
      </div>
    );
  }

  if (!displayError && guidedCanvas) {
    surfaceNode = guidedCanvas;
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
            onClick={batch.reset}
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
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">{m.batchSettingsTitle()}</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {selectedBatchItem?.originalFileName ?? m.batchSettingsEmpty()}
        </p>
      </div>
      {selectedBatchItem?.processedImage && !originalMatte && (
        <div className="flex flex-col gap-4" data-testid="batch-controls">
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
            }}
            onApply={(fill) =>
              batch.applyBackgroundFill(selectedBatchItem.processedImage!, fill)
            }
            onResult={(updated) => {
              batch.replaceResult(selectedBatchItem.id, updated);
              setBatchPreviewFills((current) => ({
                ...current,
                [selectedBatchItem.id]: updated.backgroundFill ?? {
                  type: "transparent",
                },
              }));
            }}
            onBusyChange={(itemBusy) =>
              setBatchBackgroundBusy((current) => ({
                ...current,
                [selectedBatchItem.id]: itemBusy,
              }))
            }
          />
          <div className="flex flex-wrap gap-3">
            <DownloadResultButton
              image={selectedBatchItem.processedImage.result}
              disabled={batchBackgroundBusy[selectedBatchItem.id]}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => batch.retryItem(selectedBatchItem.id)}
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
          </div>
          <p className="text-xs text-muted-foreground">
            {m.batchQualityHint({
              mode: modeLabel(selectedBatchItem.qualityMode),
            })}
          </p>
        </div>
      )}
      {!selectedBatchItem && (
        <div className="hidden min-h-48 rounded-xl border border-transparent lg:block" />
      )}
    </div>
  ) : null;

  const batchCorrecting =
    batchActive && selectedBatchItem?.processedImage && originalMatte;

  if (batchActive && !batchCorrecting) {
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
          {modelLoadBytes.loaded > 0
            ? ` · ${(modelLoadBytes.loaded / 1_048_576).toFixed(1)}${modelLoadBytes.total ? ` / ${(modelLoadBytes.total / 1_048_576).toFixed(1)}` : ""} MiB`
            : ""}
          {deviceCapabilities ? ` on ${pathLabel(deviceCapabilities.inferencePath)}` : ""}
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
        {lastLogMessage && (
          <p className="truncate text-xs text-muted-foreground/70">{lastLogMessage}</p>
        )}
      </div>
    );
  }

  if (!displayError && (state.status === "ready" || state.status === "processing")) {
    surfaceNode = (
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {state.status === "processing" ? m.removingBackground() : m.preparing()}
        </p>
        {lastLogMessage && (
          <p className="truncate text-xs text-muted-foreground/70">{lastLogMessage}</p>
        )}
      </div>
    );
  }

  if (!displayError && state.status === "result" && !guided.state.session) {
    surfaceNode = (
      <BeforeAfterSlider
        before={state.result.source}
        after={state.result.cutout ?? state.result.result}
        backgroundFill={previewFill}
      />
    );
    railNode = (
      <div className="flex flex-col gap-4">
        <BackgroundFillSelector
          image={{
            source: state.result.source,
            backgroundFill: state.result.backgroundFill,
          }}
          onPreview={setPreviewFill}
          onApply={(fill) => applyBackgroundFill(state.result, fill)}
          onResult={(updated) => {
            replaceResult(updated);
            setPreviewFill(updated.backgroundFill ?? { type: "transparent" });
          }}
          onBusyChange={setBackgroundBusy}
        />
        <div className="flex flex-wrap gap-3">
          <DownloadResultButton image={state.result.result} disabled={backgroundBusy} />
          <Button type="button" variant="outline" onClick={handleReset}>
            {m.processAnother()}
          </Button>
          {state.result.qualityMode !== "max" &&
            state.result.qualityMode !== "isnet-fp32" && (
              <Button type="button" variant="secondary" onClick={recomputeMaxQuality}>
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
        {correctionError && (
          <CorrectionErrorAlert
            error={correctionError}
            onRetry={handleRetry}
            onReset={handleReset}
          />
        )}
      </div>
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
      >
        {({ surface, rail }) => (
          <>
            <div className="[grid-area:surface]">{surface}</div>
            <div className="flex flex-col gap-4 [grid-area:rail]">
              {correctionError && (
                <CorrectionErrorAlert
                  error={correctionError}
                  onRetry={handleRetry}
                  onReset={handleReset}
                />
              )}
              {rail}
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
      >
        {({ surface, rail }) => (
          <>
            <div className="flex flex-col gap-4 [grid-area:surface]">
              {batchSurfaceBase}
              {surface}
            </div>
            <div className="flex flex-col gap-4 [grid-area:rail]">
              {batchRailBase}
              {rail}
            </div>
          </>
        )}
      </MaskCorrectionSlots>
    );
  }

  return (
    <div
      data-testid="tool-workspace"
      className={`tool-workspace-grid ${state.status === "idle" && !batchActive ? "tool-workspace-idle" : ""} ${batchActive ? "tool-workspace-batch" : ""}`}
    >
      <div aria-live="polite" role="status" className="sr-only">
        {guided.state.session
          ? describeGuidedState(guided.state.status, guided.state.progress)
          : batch.session.items.length
            ? m.batchCompleteAnnouncement({
                done: batch.snapshot.completedCount,
                total: batch.snapshot.totalCount,
                failed: batch.snapshot.failedCount,
              })
            : describeState(state, lightweightMode, uploadError)}
        {state.status === "correcting" && correctionViewAnnouncement
          ? `. ${correctionViewAnnouncement}.`
          : ""}
      </div>

      {!batchActive && !guided.state.session && (
        <div className="[grid-area:toggle]">
          {state.status === "idle" && (
            <fieldset className="mb-3 space-y-2" data-testid="processing-method-selector">
              <legend className="text-sm font-semibold">
                {m.processingMethodLabel()}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={guidedEntry ? "outline" : "default"}
                  className="h-auto justify-start whitespace-normal p-3 text-left"
                  aria-pressed={!guidedEntry}
                  disabled={!hydrated}
                  onClick={() => setGuidedEntry(false)}
                >
                  <span>
                    <span className="block font-medium">{m.automaticMethod()}</span>
                    <span className="mt-1 block text-xs font-normal opacity-80">
                      {m.automaticMethodHint()}
                    </span>
                  </span>
                </Button>
                <Button
                  type="button"
                  variant={guidedEntry ? "default" : "outline"}
                  className="h-auto justify-start whitespace-normal p-3 text-left"
                  aria-pressed={guidedEntry}
                  disabled={!hydrated}
                  onClick={() => setGuidedEntry(true)}
                >
                  <span>
                    <span className="block font-medium">{m.guidedMethod()}</span>
                    <span className="mt-1 block text-xs font-normal opacity-80">
                      {m.guidedMethodHint()}
                    </span>
                  </span>
                </Button>
              </div>
            </fieldset>
          )}
          {!guidedEntry && (
            <QualityModeToggle
              qualityMode={qualityMode}
              onQualityModeChange={setQualityMode}
              disabled={!hydrated}
            />
          )}
          {state.status === "idle" && guidedEntry && (
            <div
              role="status"
              className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm"
            >
              <p className="font-medium">{m.guidedMethodMeta()}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.guidedUploadHint()}</p>
            </div>
          )}
        </div>
      )}

      {runInfo && (
        <p className="text-xs text-muted-foreground [grid-area:info]">
          Model: IS-Net ({runInfo.dtype}) · Running on {pathLabel(runInfo.inferencePath)}
        </p>
      )}

      {lightweightMode && !displayError && (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground [grid-area:notice]">
          Running in lightweight mode — WebGPU is unavailable
          {runInfo ? " for this model" : ""}, using the slower WASM path.
        </p>
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
          <p>{displayError.message}</p>
          {displayError.action === "retry" ? (
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
      {batchListNode && <div className="[grid-area:batch]">{batchListNode}</div>}

      {correctionGridBody ?? (
        <>
          {surfaceNode && <div className="[grid-area:surface]">{surfaceNode}</div>}
          {railNode && <div className="[grid-area:rail]">{railNode}</div>}
        </>
      )}

      <div className="[grid-area:log]">
        <ProcessingLog logs={logs} />
      </div>
    </div>
  );
}
