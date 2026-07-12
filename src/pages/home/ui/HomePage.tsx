import { useEffect, useRef, useState } from "react";

import type {
  AlphaMatte,
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
import { DownloadAllButton } from "../../../features/download-result";
import { BatchGrid, useBatchProcessing } from "../../../features/batch-processing";
import {
  detectDeviceCapabilities,
  useBackgroundRemoval,
} from "../../../features/remove-background";
import { QualityModeToggle, useQualityMode } from "../../../features/quality-mode-toggle";
import {
  ChoosePhotoButton,
  UploadDropzone,
  UploadPreparationNotice,
  type UploadResult,
  type UploadValidationError,
} from "../../../features/upload-image";
import { Button } from "@/shared/ui";
import { describeState } from "../lib/describe-state";
import { sourceImageToFile } from "../lib/source-image-to-file";
import { ProcessingLog } from "./ProcessingLog";

function pathLabel(path: "webgpu" | "wasm"): string {
  return path === "webgpu" ? "WebGPU" : "WASM";
}

interface MaskCorrectionPanelProps {
  sourceImage: SourceImage;
  originalMatte: AlphaMatte;
  onDone: (matte: AlphaMatte) => void;
  doneDisabled?: boolean;
  onViewAnnouncementChange: (announcement: string) => void;
}

/**
 * Composes `features/correct-mask`'s hook + canvas + toolbar into the
 * `correcting` state's UI (Phase 07, SPEC.md §5.2/§5.3) — kept local to this
 * page (not exported) since `pages/home` is the only place it's mounted this
 * phase (SPEC.md §8 scopes the entry point to `pages/home` only).
 */
function MaskCorrectionPanel({
  sourceImage,
  originalMatte,
  onDone,
  doneDisabled = false,
  onViewAnnouncementChange,
}: MaskCorrectionPanelProps) {
  // The working matte lives inside MaskCorrectionCanvas's persistent buffer,
  // reached imperatively via this handle (undo/redo patches in, final matte
  // out on Done) — never through props/state, which is what froze the app
  // for 1-2s per stroke under React 19.2's dev-mode Performance Track
  // (Architect Review Notes R4, docs/KNOWN_GOTCHAS.md).
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

  return (
    <div className="flex flex-col gap-4">
      <MaskCorrectionCanvas
        ref={canvasHandleRef}
        sourceImage={sourceImage}
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
        Done
      </Button>
    </div>
  );
}

type DisplayError = { message: string; action: "retry" | "reset" };

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
          Try again
        </Button>
        <Button type="button" variant="outline" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}

export function HomePage() {
  const [defaultQualityMode, setDefaultQualityMode] = useState<QualityMode>("fast");
  const [uploadError, setUploadError] = useState<UploadValidationError | null>(null);
  const [preparingFileCount, setPreparingFileCount] = useState(0);
  const [originalMatte, setOriginalMatte] = useState<AlphaMatte | null>(null);
  const [extractingMatte, setExtractingMatte] = useState(false);
  const [finalizingCorrection, setFinalizingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<DisplayError | null>(null);
  const [correctionViewAnnouncement, setCorrectionViewAnnouncement] = useState("");
  const retryCorrectionRef = useRef<(() => void) | null>(null);
  const correctionRunRef = useRef(0);
  // TanStack Start SSRs this page's markup before client hydration attaches
  // `UploadDropzone`/`ChoosePhotoButton`'s onChange/onDrop handlers — a real
  // interaction in that window is visually indistinguishable from a working
  // control but silently drops the event (same class of bug as
  // docs/KNOWN_GOTCHAS.md's Playwright-hydration-race entry, but reproducible
  // by a real user's very first upload attempt, not just automation). `false`
  // on both the server render and the first client render, flipping to `true`
  // only once this effect actually runs — i.e. only once hydration has
  // completed and the upload controls' own handlers are live.
  const [hydrated, setHydrated] = useState(false);

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
    selectFile,
    recomputeMaxQuality,
    retry,
    reset,
    enterCorrecting,
    exitCorrecting,
    extractMatte,
    recomposite,
  } = useBackgroundRemoval(qualityMode);
  const batch = useBatchProcessing({
    qualityMode,
    inferencePath: deviceCapabilities?.inferencePath ?? "wasm",
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
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    setUploadError(null);
    selectFile(sourceImageToFile(result.image));
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
    reset();
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
    setExtractingMatte(true);
    void batch
      .extractMatte(image)
      .then((matte) => {
        setExtractingMatte(false);
        setOriginalMatte(matte);
      })
      .catch((error: unknown) => {
        setExtractingMatte(false);
        setCorrectionError({
          message: `Could not prepare mask editor: ${error instanceof Error ? error.message : String(error)}`,
          action: "retry",
        });
      });
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
    ? { message: uploadError.message, action: "reset" }
    : state.status === "error"
      ? { message: state.error.message, action: state.error.action }
      : null;

  return (
    <main
      data-testid="home-page"
      className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-6 sm:p-8"
    >
      <header>
        <h1 className="text-2xl font-semibold">Remove image background</h1>
        <p className="text-sm text-muted-foreground">
          Upload a photo — get a transparent PNG in seconds.
        </p>
      </header>

      <div aria-live="polite" role="status" className="sr-only">
        {batch.session.items.length
          ? `${String(batch.snapshot.completedCount)} of ${String(batch.snapshot.totalCount)} batch items complete; ${String(batch.snapshot.failedCount)} failed.`
          : describeState(state, lightweightMode, uploadError)}
        {state.status === "correcting" && correctionViewAnnouncement
          ? `. ${correctionViewAnnouncement}.`
          : ""}
      </div>

      <QualityModeToggle qualityMode={qualityMode} onQualityModeChange={setQualityMode} />

      {runInfo && (
        <p className="text-xs text-muted-foreground">
          Model: IS-Net ({runInfo.dtype}) · Running on {pathLabel(runInfo.inferencePath)}
        </p>
      )}

      {lightweightMode && !displayError && (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          Running in lightweight mode — WebGPU is unavailable
          {runInfo ? " for this model" : ""}, using the slower WASM path.
        </p>
      )}

      {displayError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p>{displayError.message}</p>
          {displayError.action === "retry" ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleRetry}
              className="self-start"
            >
              Try again
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="self-start"
            >
              Reset
            </Button>
          )}
        </div>
      )}

      {!displayError && state.status === "idle" && !batch.session.items.length && (
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
      )}

      {!displayError && batch.session.items.length > 0 && (
        <div className="flex flex-col gap-4">
          <UploadDropzone
            onUpload={handleUpload}
            onUploads={handleUploads}
            onPreparationChange={setPreparingFileCount}
            disabled={!hydrated || preparingFileCount > 0}
          />
          <UploadPreparationNotice fileCount={preparingFileCount} />
          <BatchGrid
            items={batch.session.items}
            snapshot={batch.snapshot}
            selectedItemId={batch.session.selectedItemId}
            modelLoad={batch.session.modelLoads[batchModelKey]}
            onSelect={batch.selectItem}
            onRetry={batch.retryItem}
          />
          <div className="flex flex-wrap gap-3">
            <DownloadAllButton items={batch.session.items} />
            <Button type="button" variant="outline" onClick={batch.reset}>
              Clear batch
            </Button>
          </div>
          {selectedBatchItem?.processedImage && !originalMatte && (
            <div
              className="flex flex-col gap-4"
              aria-label={`Selected ${selectedBatchItem.originalFileName}`}
            >
              <BeforeAfterSlider
                before={selectedBatchItem.processedImage.source}
                after={selectedBatchItem.processedImage.result}
              />
              <div className="flex flex-wrap gap-3">
                <DownloadResultButton image={selectedBatchItem.processedImage.result} />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => batch.retryItem(selectedBatchItem.id)}
                >
                  Reprocess in {selectedBatchItem.qualityMode === "max" ? "Max" : "Fast"}{" "}
                  mode
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBatchEditMask}
                  disabled={extractingMatte}
                >
                  {extractingMatte ? "Preparing…" : "Edit mask"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Reprocessing keeps this item&apos;s saved{" "}
                {selectedBatchItem.qualityMode === "max" ? "Max" : "Fast"} mode. The
                Quality mode toggle applies to images added after you change it.
              </p>
            </div>
          )}
          {selectedBatchItem?.processedImage && originalMatte && (
            <MaskCorrectionPanel
              sourceImage={selectedBatchItem.processedImage.source}
              originalMatte={originalMatte}
              onDone={handleBatchDoneCorrecting}
              doneDisabled={finalizingCorrection}
              onViewAnnouncementChange={setCorrectionViewAnnouncement}
            />
          )}
        </div>
      )}

      {!displayError && state.status === "model-loading" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Loading {state.qualityMode === "max" ? "max quality" : "fast"} model…{" "}
            {state.progress.toFixed(0)}%
            {modelLoadBytes.loaded > 0
              ? ` · ${(modelLoadBytes.loaded / 1_048_576).toFixed(1)}${modelLoadBytes.total ? ` / ${(modelLoadBytes.total / 1_048_576).toFixed(1)}` : ""} MiB`
              : ""}
            {deviceCapabilities
              ? ` on ${pathLabel(deviceCapabilities.inferencePath)}`
              : ""}
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
      )}

      {!displayError && (state.status === "ready" || state.status === "processing") && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {state.status === "processing" ? "Removing background…" : "Preparing…"}
          </p>
          {lastLogMessage && (
            <p className="truncate text-xs text-muted-foreground/70">{lastLogMessage}</p>
          )}
        </div>
      )}

      {!displayError && state.status === "result" && (
        <div className="flex flex-col gap-4">
          <BeforeAfterSlider before={state.result.source} after={state.result.result} />
          <div className="flex flex-wrap gap-3">
            <DownloadResultButton image={state.result.result} />
            <Button type="button" variant="outline" onClick={handleReset}>
              Process another image
            </Button>
            {state.result.qualityMode !== "max" && (
              <Button type="button" variant="secondary" onClick={recomputeMaxQuality}>
                Recompute in max quality
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={handleEditMask}
              disabled={extractingMatte}
            >
              {extractingMatte ? "Preparing…" : "Edit mask"}
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
      )}

      {!displayError && state.status === "correcting" && originalMatte && (
        <div className="flex flex-col gap-4">
          {correctionError && (
            <CorrectionErrorAlert
              error={correctionError}
              onRetry={handleRetry}
              onReset={handleReset}
            />
          )}
          <MaskCorrectionPanel
            sourceImage={state.result.source}
            originalMatte={originalMatte}
            onDone={handleDoneCorrecting}
            doneDisabled={finalizingCorrection}
            onViewAnnouncementChange={setCorrectionViewAnnouncement}
          />
        </div>
      )}

      <ProcessingLog logs={logs} />
    </main>
  );
}
