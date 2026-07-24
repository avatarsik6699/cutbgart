import { useEffect } from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../shared/ui";
import {
  INTERACTIVE_EVALUATION_MODELS,
  formatModelSize,
  getInteractiveEvaluationModel,
} from "../model/model-registry";
import type { InteractiveEvaluationModelId } from "../model/types";
import { useInteractiveMattingLab } from "../model/use-interactive-matting-lab";

function metric(value: number | null, digits = 3): string {
  return value === null ? "—" : value.toFixed(digits);
}

export function InteractiveMattingLab({
  disabled = false,
  onRunningChange,
}: {
  disabled?: boolean;
  onRunningChange?: (running: boolean) => void;
}) {
  const {
    state,
    capabilities,
    setOptedIn,
    loadSyntheticCorpus,
    setModelSelected,
    run,
    cancel,
    reset,
    setDecision,
    downloadExport,
  } = useInteractiveMattingLab();
  const isRunning = state.status === "running";
  const controlsDisabled = disabled || isRunning;

  useEffect(() => {
    onRunningChange?.(isRunning);
  }, [isRunning, onRunningChange]);

  return (
    <section
      data-testid="interactive-matting-lab"
      aria-labelledby="interactive-matting-title"
      className="space-y-5 rounded-xl border border-dashed p-4 sm:p-6"
    >
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Phase 18 · evaluation only
        </p>
        <h2 id="interactive-matting-title" className="text-2xl font-semibold">
          Interactive Matting Lab
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Изолированное сравнение alpha-refiner моделей на синтетическом корпусе. Оно не
          меняет production-обработку, CDN или Service Worker. Экспорт не содержит
          пиксели, имена файлов и prompt-координаты.
        </p>
        <label className="flex items-start gap-2 text-sm font-medium">
          <input
            data-testid="matting-opt-in"
            type="checkbox"
            checked={state.optedIn}
            disabled={controlsDisabled}
            onChange={(event) => setOptedIn(event.target.checked)}
          />
          Я понимаю, что кандидаты загружаются только после явного запуска лаборатории
        </label>
      </div>

      {state.optedIn && (
        <>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Кандидаты и license gate</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {INTERACTIVE_EVALUATION_MODELS.map((model) => (
                <Card key={model.id} size="sm">
                  <CardHeader>
                    <CardTitle>
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          aria-label={model.label}
                          checked={state.selectedModelIds.includes(model.id)}
                          disabled={controlsDisabled}
                          onChange={(event) =>
                            setModelSelected(model.id, event.target.checked)
                          }
                        />
                        {model.label}
                      </label>
                    </CardTitle>
                    <CardDescription>
                      {model.approximateBytes > 0
                        ? `${formatModelSize(model.approximateBytes)} · `
                        : "size unavailable · "}
                      {model.dtype} · {model.license}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      {model.family} · {model.eligibility}
                    </p>
                    <p>{model.resourceWarning}</p>
                    {"unsupportedReason" in model && model.unsupportedReason && (
                      <p>{model.unsupportedReason}</p>
                    )}
                    <p className="break-all">revision: {model.revision.slice(0, 12)}…</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Локальный quality corpus</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                data-testid="load-matting-corpus"
                type="button"
                variant="outline"
                disabled={controlsDisabled}
                onClick={() => void loadSyntheticCorpus()}
              >
                Создать синтетический корпус
              </Button>
              <Button
                data-testid="run-matting-lab"
                type="button"
                disabled={
                  controlsDisabled ||
                  state.cases.length === 0 ||
                  state.selectedModelIds.length === 0
                }
                onClick={() => void run()}
              >
                Запустить matting matrix
              </Button>
              {isRunning && (
                <Button type="button" variant="outline" onClick={cancel}>
                  Отменить matting matrix
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                disabled={controlsDisabled}
                onClick={reset}
              >
                Сбросить matting lab
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {state.cases.length === 0
                ? "Корпус ещё не создан."
                : `Корпус: ${String(state.cases.length)} случаев — ${state.cases.map(({ category }) => category).join(", ")}.`}
            </p>
            <p
              role="status"
              aria-live="polite"
              data-testid="matting-lab-progress"
              className="text-sm"
            >
              Статус: {state.status} · {state.progress.completed}/{state.progress.total}
              {state.current
                ? ` · ${getInteractiveEvaluationModel(state.current.modelId).label} · case ${String(state.current.caseOrdinal)} · ${state.current.stage}${state.current.percent === null ? "" : ` ${state.current.percent.toFixed(0)}%`}`
                : ""}
            </p>
            <p
              data-testid="matting-capabilities"
              className="text-xs text-muted-foreground"
            >
              Runtime: {capabilities?.requestedPath ?? "определяется после запуска"} ·
              peak memory API: unavailable values remain explicit
            </p>
            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
          </div>

          {state.runtime.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-4xl border-collapse text-left text-xs">
                <caption className="mb-2 text-left text-base font-semibold">
                  Runtime и alpha/boundary quality
                </caption>
                <thead>
                  <tr className="border-b">
                    <th className="p-2">Case</th>
                    <th className="p-2">Model</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Load</th>
                    <th className="p-2">Warm</th>
                    <th className="p-2">IoU</th>
                    <th className="p-2">Boundary IoU</th>
                    <th className="p-2">SAD</th>
                    <th className="p-2">MSE</th>
                    <th className="p-2">Gradient</th>
                    <th className="p-2">Connectivity</th>
                    <th className="p-2">Memory</th>
                  </tr>
                </thead>
                <tbody>
                  {state.runtime.map((runtime) => {
                    const quality = state.quality.find(
                      (item) =>
                        item.caseOrdinal === runtime.caseOrdinal &&
                        item.modelId === runtime.modelId,
                    );
                    return (
                      <tr
                        key={`${runtime.modelId}-${String(runtime.caseOrdinal)}`}
                        className="border-b"
                      >
                        <td className="p-2">{runtime.caseOrdinal}</td>
                        <td className="p-2">
                          {getInteractiveEvaluationModel(runtime.modelId).label}
                        </td>
                        <td className="p-2">
                          {runtime.status}
                          {runtime.errorCode ? ` (${runtime.errorCode})` : ""}
                        </td>
                        <td className="p-2">{runtime.coldLoadMs} ms</td>
                        <td className="p-2">{runtime.warmInferenceMs} ms</td>
                        <td className="p-2">{metric(quality?.iou ?? null)}</td>
                        <td className="p-2">{metric(quality?.boundaryIou ?? null)}</td>
                        <td className="p-2">{metric(quality?.sad ?? null)}</td>
                        <td className="p-2">{metric(quality?.mse ?? null, 5)}</td>
                        <td className="p-2">{metric(quality?.gradient ?? null, 5)}</td>
                        <td className="p-2">
                          {metric(quality?.connectivity ?? null, 5)}
                        </td>
                        <td className="p-2">{runtime.memoryObservation}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {state.previews.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {state.previews.map((preview) => (
                <figure
                  key={`${preview.modelId}-${String(preview.caseOrdinal)}`}
                  className="space-y-1"
                >
                  <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border bg-muted/30">
                    <img
                      src={preview.resultUrl}
                      alt={`${getInteractiveEvaluationModel(preview.modelId).label}, alpha preview, case ${String(preview.caseOrdinal)}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <figcaption className="text-xs text-muted-foreground">
                    Case {preview.caseOrdinal} · {preview.modelId}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {state.status === "complete" && (
            <div className="space-y-3 border-t pt-4">
              <label className="block max-w-xl space-y-1 text-sm">
                <span className="font-medium">Решение для Phase 19</span>
                <select
                  data-testid="matting-decision"
                  className="block h-9 w-full rounded-lg border bg-background px-3"
                  value={state.decision}
                  onChange={(event) =>
                    setDecision(
                      event.target.value as InteractiveEvaluationModelId | "none",
                    )
                  }
                >
                  <option value="none">Ни один — deterministic fallback</option>
                  {state.selectedModelIds.map((modelId) => (
                    <option key={modelId} value={modelId}>
                      {getInteractiveEvaluationModel(modelId).label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                data-testid="matting-lab-export"
                type="button"
                variant="outline"
                onClick={downloadExport}
              >
                Скачать image-free matting JSON
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
