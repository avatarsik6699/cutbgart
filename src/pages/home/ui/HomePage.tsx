import { useEffect, useState } from "react";

import type { QualityMode } from "../../../entities/processed-image";
import { BeforeAfterSlider } from "../../../entities/processed-image";
import { DownloadResultButton } from "../../../features/download-result";
import {
  detectDeviceCapabilities,
  useBackgroundRemoval,
} from "../../../features/remove-background";
import { QualityModeToggle, useQualityMode } from "../../../features/quality-mode-toggle";
import {
  ChoosePhotoButton,
  UploadDropzone,
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

type DisplayError = { message: string; action: "retry" | "reset" };

export function HomePage() {
  const [defaultQualityMode, setDefaultQualityMode] = useState<QualityMode>("fast");
  const [uploadError, setUploadError] = useState<UploadValidationError | null>(null);

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
    selectFile,
    recomputeMaxQuality,
    retry,
    reset,
  } = useBackgroundRemoval(qualityMode);
  const lastLogMessage = logs.at(-1)?.message;

  function handleUpload(result: UploadResult) {
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    setUploadError(null);
    selectFile(sourceImageToFile(result.image));
  }

  function handleReset() {
    setUploadError(null);
    reset();
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
        {describeState(state, lightweightMode, uploadError)}
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
              onClick={retry}
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

      {!displayError && state.status === "idle" && (
        <div className="flex flex-col gap-3">
          <UploadDropzone onUpload={handleUpload} disabled={busy} />
          <ChoosePhotoButton onUpload={handleUpload} disabled={busy} />
        </div>
      )}

      {!displayError && state.status === "model-loading" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Loading {state.qualityMode === "max" ? "max quality" : "fast"} model…{" "}
            {state.progress.toFixed(0)}%
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
          </div>
        </div>
      )}

      <ProcessingLog logs={logs} />
    </main>
  );
}
