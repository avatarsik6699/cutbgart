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

type DisplayError = { message: string; action: "retry" | "reset" };

function describeState(
  status: string,
  progress: number,
  lightweightMode: boolean,
): string {
  switch (status) {
    case "idle":
      return "Ready to upload an image.";
    case "model-loading":
      return `Loading model${lightweightMode ? " in lightweight mode" : ""}, ${String(Math.round(progress))} percent.`;
    case "ready":
      return "Model ready, starting processing.";
    case "processing":
      return "Removing background…";
    case "result":
      return "Background removed. Result ready to review and download.";
    default:
      return "";
  }
}

function sourceImageToFile(image: { blob: Blob; format: string }): File {
  return new File([image.blob], "upload", { type: image.format });
}

/**
 * `/udalit-fon-s-logotipa` — logo scenario (SPEC.md §5.1, desired). Same
 * composition pattern as `pages/product-photo`.
 */
export function LogoPage() {
  const [defaultQualityMode, setDefaultQualityMode] = useState<QualityMode>("fast");
  const [uploadError, setUploadError] = useState<UploadValidationError | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration gate: upload controls must stay disabled until React handlers are attached.
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
  const { state, lightweightMode, selectFile, recomputeMaxQuality, retry, reset } =
    useBackgroundRemoval(qualityMode);

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
      data-testid="logo-page"
      className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-6 sm:p-8"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Удалить фон с логотипа</h1>
        <p className="text-sm text-muted-foreground">
          Remove the background from a logo — turn a flat JPG/PNG into a transparent PNG
          ready to overlay on any surface, processed entirely in your browser.
        </p>
      </header>

      <p className="text-sm text-muted-foreground">
        Логотип часто присылают в виде обычной картинки со сплошным белым или цветным
        фоном — такой файл неудобно накладывать на слайд презентации, шаблон соцсетей или
        упаковку товара. Загрузите изображение с логотипом, и фон вокруг него будет
        удалён, оставив чистый знак на прозрачной подложке.
      </p>
      <p className="text-sm text-muted-foreground">
        Инструмент лучше всего подходит для логотипов с чёткими краями и контрастным
        фоном; для сложных градиентных подложек результат стоит проверить крупным планом
        перед использованием. Файл не загружается ни на один сервер — вся обработка идёт
        на вашем устройстве.
      </p>

      <div aria-live="polite" role="status" className="sr-only">
        {displayError
          ? displayError.message
          : describeState(
              state.status,
              state.status === "model-loading" ? state.progress : 0,
              lightweightMode,
            )}
      </div>

      <QualityModeToggle qualityMode={qualityMode} onQualityModeChange={setQualityMode} />

      {lightweightMode && !displayError && (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          Running in lightweight mode — WebGPU is unavailable, using the slower WASM path.
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
          <UploadDropzone onUpload={handleUpload} disabled={!hydrated || busy} />
          <ChoosePhotoButton onUpload={handleUpload} disabled={!hydrated || busy} />
        </div>
      )}

      {!displayError && state.status === "model-loading" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Loading {state.qualityMode === "max" ? "max quality" : "fast"} model…{" "}
            {state.progress.toFixed(0)}%
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
      )}

      {!displayError && (state.status === "ready" || state.status === "processing") && (
        <p className="text-sm text-muted-foreground">
          {state.status === "processing" ? "Removing background…" : "Preparing…"}
        </p>
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

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-lg font-medium">Пример / Example</h2>
        <img
          src="/images/logo-example.webp"
          alt="Logo before and after background removal"
          loading="lazy"
          width={960}
          height={540}
          className="w-full rounded-xl border border-border"
        />
        <p className="text-sm text-muted-foreground">
          Слева — логотип на исходном фоне, справа — тот же логотип с прозрачным фоном.
        </p>
      </section>
    </main>
  );
}
