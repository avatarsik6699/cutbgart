import { useMemo } from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";
import {
  EVALUATION_MODELS,
  formatModelSize,
  getEvaluationModel,
} from "../model/model-registry";
import type { BenchmarkPreference } from "../model/types";
import { useModelLab } from "../model/use-model-lab";

function formatDuration(value: number): string {
  return value === 0 ? "warm" : `${(value / 1000).toFixed(2)} с`;
}

export function ModelLab() {
  const {
    state,
    capabilities,
    selectFiles,
    setModelSelected,
    runComparison,
    cancel,
    reset,
    setPreference,
    downloadExport,
  } = useModelLab();

  const resultsByImage = useMemo(
    () =>
      new Map(
        state.images.map((image) => [
          image.ordinal,
          state.results.filter((result) => result.imageOrdinal === image.ordinal),
        ]),
      ),
    [state.images, state.results],
  );

  const isRunning = state.status === "running";
  const canRun =
    !isRunning && state.images.length > 0 && state.selectedModelIds.length >= 2;

  return (
    <main
      data-testid="model-lab"
      className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8"
    >
      <header className="space-y-2">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Internal · noindex
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Browser Model Evaluation Lab
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Изображения обрабатываются только в этом браузере. Модели загружаются после
          нажатия «Запустить сравнение», по одной. Экспорт содержит только технические
          измерения и выбор результата — без изображений и имён файлов.
        </p>
        <p data-testid="model-lab-capabilities" className="text-sm">
          Путь: <strong>{capabilities?.requestedPath ?? "определяется…"}</strong> · CPU
          threads: {capabilities?.hardwareConcurrency ?? "—"} · device memory:{" "}
          {capabilities?.deviceMemoryGb
            ? `${String(capabilities.deviceMemoryGb)} GB`
            : "—"}{" "}
          · cross-origin isolated: {capabilities?.crossOriginIsolated ? "yes" : "no"}
        </p>
      </header>

      <section aria-labelledby="model-selection-title" className="space-y-3">
        <h2 id="model-selection-title" className="text-xl font-semibold">
          1. Модели
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {EVALUATION_MODELS.map((model) => {
            const checked = state.selectedModelIds.includes(model.id);
            return (
              <Card key={model.id} size="sm">
                <CardHeader>
                  <CardTitle>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        name="evaluation-model"
                        value={model.id}
                        checked={checked}
                        disabled={isRunning}
                        onChange={(event) =>
                          setModelSelected(model.id, event.target.checked)
                        }
                      />
                      {model.label}
                    </label>
                  </CardTitle>
                  <CardDescription>
                    {formatModelSize(model.approximateBytes)} · {model.dtype} ·{" "}
                    {model.license}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  <p>{model.resourceWarning}</p>
                  <p className="mt-2 break-all">
                    revision: {model.revision.slice(0, 12)}…
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {state.selectedModelIds.length < 2 && (
          <p role="alert" className="text-sm text-destructive">
            Для сравнения выберите минимум две модели.
          </p>
        )}
      </section>

      <section aria-labelledby="image-selection-title" className="space-y-3">
        <h2 id="image-selection-title" className="text-xl font-semibold">
          2. Локальные изображения
        </h2>
        <input
          data-testid="model-lab-files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={isRunning}
          onChange={(event) => {
            void selectFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <p className="text-sm text-muted-foreground">
          Загружено: {state.images.length}. В отчёте они обозначаются только номерами.
        </p>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </section>

      <section aria-labelledby="run-title" className="space-y-3">
        <h2 id="run-title" className="text-xl font-semibold">
          3. Последовательный запуск
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!canRun} onClick={() => void runComparison()}>
            Запустить сравнение
          </Button>
          {isRunning && (
            <Button type="button" variant="outline" onClick={cancel}>
              Отменить
            </Button>
          )}
          <Button type="button" variant="ghost" disabled={isRunning} onClick={reset}>
            Сбросить
          </Button>
        </div>
        <p role="status" aria-live="polite" data-testid="model-lab-progress">
          Статус: {state.status} · {state.progress.completed}/{state.progress.total}
          {state.current
            ? ` · ${getEvaluationModel(state.current.modelId).label} · изображение ${String(state.current.imageOrdinal)} · ${state.current.stage}${state.current.percent === null ? "" : ` ${state.current.percent.toFixed(0)}%`}`
            : ""}
        </p>
      </section>

      {state.images.map((image) => {
        const results = resultsByImage.get(image.ordinal) ?? [];
        const preference = state.preferences.find(
          (item) => item.imageOrdinal === image.ordinal,
        );
        return (
          <section
            key={image.id}
            data-testid={`model-lab-image-${String(image.ordinal)}`}
            className="space-y-4 border-t pt-6"
          >
            <h2 className="text-xl font-semibold">Изображение {image.ordinal}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <figure className="space-y-2">
                <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border bg-muted/40">
                  <img
                    src={image.sourceUrl}
                    alt={`Исходное изображение ${String(image.ordinal)}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <figcaption className="text-sm font-medium">Оригинал</figcaption>
              </figure>
              {state.selectedModelIds.map((modelId) => {
                const result = results.find((item) => item.modelId === modelId);
                const measurement = state.measurements.find(
                  (item) =>
                    item.imageOrdinal === image.ordinal && item.modelId === modelId,
                );
                return (
                  <figure key={modelId} className="space-y-2">
                    <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px]">
                      {result ? (
                        <img
                          src={result.resultUrl}
                          alt={`${getEvaluationModel(modelId).label}, результат для изображения ${String(image.ordinal)}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : measurement?.status === "error" ? (
                        <p className="p-3 text-center text-xs text-destructive">
                          {measurement.errorCode}
                        </p>
                      ) : (
                        <span className="text-xs text-muted-foreground">ожидает</span>
                      )}
                    </div>
                    <figcaption className="space-y-1 text-sm">
                      <strong>{getEvaluationModel(modelId).label}</strong>
                      {measurement && (
                        <span className="block text-xs text-muted-foreground">
                          load: {formatDuration(measurement.loadMs)} · inference:{" "}
                          {formatDuration(measurement.inferenceMs)} ·{" "}
                          {measurement.actualPath}
                        </span>
                      )}
                      {result && (
                        <a
                          href={result.resultUrl}
                          download={`image-${String(image.ordinal)}-${modelId}.png`}
                          className="block text-xs underline underline-offset-2"
                        >
                          Скачать полноразмерный результат
                        </a>
                      )}
                    </figcaption>
                  </figure>
                );
              })}
            </div>

            {state.status === "complete" && (
              <label className="block max-w-md space-y-1 text-sm">
                <span className="font-medium">
                  Какой результат лучше сохраняет объект?
                </span>
                <select
                  aria-label={`Лучший результат для изображения ${String(image.ordinal)}`}
                  className="block h-9 w-full rounded-lg border bg-background px-3"
                  value={preference?.preferredModelId ?? ""}
                  onChange={(event) =>
                    setPreference({
                      imageOrdinal: image.ordinal,
                      preferredModelId: event.target
                        .value as BenchmarkPreference["preferredModelId"],
                    })
                  }
                >
                  <option value="" disabled>
                    Выберите результат
                  </option>
                  {state.selectedModelIds.map((modelId) => (
                    <option key={modelId} value={modelId}>
                      {getEvaluationModel(modelId).label}
                    </option>
                  ))}
                  <option value="tie">Одинаково</option>
                  <option value="neither">Ни один</option>
                </select>
              </label>
            )}
          </section>
        );
      })}

      {state.status === "complete" && (
        <section className="space-y-2 border-t pt-6">
          <h2 className="text-xl font-semibold">4. Экспорт измерений</h2>
          <p className="text-sm text-muted-foreground">
            JSON не содержит изображения, blob/data URL и имена файлов.
          </p>
          <Button
            data-testid="model-lab-export"
            type="button"
            variant="outline"
            onClick={downloadExport}
          >
            Скачать JSON
          </Button>
        </section>
      )}
    </main>
  );
}
