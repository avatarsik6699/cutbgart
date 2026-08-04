import { availableExportSizes, DownloadSplitControl } from "@/features/download-result";
import { QualityModeToggle } from "@/features/quality-mode-toggle";
import { ChooseFilesButton, FileDropzone } from "@/features/upload-image";
import { m } from "@/paraglide/messages";
import {
  Button,
  EditorStage,
  MainPageEmptySurface,
  MainPageIntro,
  Skeleton,
} from "@/shared/ui";
import { EditorToolbar, LocalExecutionReadout } from "@/widgets/tool-workspace";
import { Typography } from "@/v2/shared/ui";

import type { MainPageEditorPresentationProps } from "./main-page-editor-contract";
import { MainPageBatchActions } from "./main-page-batch-actions";
import { MainPageBatchRail } from "./main-page-batch-rail";
import { MainPageResultRail } from "./main-page-result-rail";
import { MainPageStageContent } from "./main-page-stage-content";

function modeLabel(
  mode: MainPageEditorPresentationProps["projection"]["qualityMode"],
): string {
  if (mode === "isnet-fp32") return m.processingModePrecise();
  if (mode === "ben2-fp16") return m.processingModeBen2();
  return m.processingModeFast();
}

export function MainPageEditorView(props: MainPageEditorPresentationProps) {
  const projection = props.projection;
  const batch =
    props.batch && props.onBatchIntent
      ? { projection: props.batch, onIntent: props.onBatchIntent }
      : null;
  const batchActive = batch !== null && batch.projection.items.length > 0;
  const emptyLike =
    !batchActive &&
    (projection.phase === "empty" ||
      (projection.phase === "error" && projection.sourcePreviewUrl === null));
  const busy =
    projection.phase === "preparing" ||
    projection.phase === "loading-model" ||
    projection.phase === "processing";
  const dimensions =
    projection.width === null || projection.height === null
      ? null
      : { width: projection.width, height: projection.height };
  const exportSizes =
    dimensions === null ? (["original"] as const) : availableExportSizes(dimensions);
  const selectedExportSize = exportSizes.includes(projection.exportSize)
    ? projection.exportSize
    : "original";
  const loadingText = m.loadingModel({
    mode: modeLabel(projection.qualityMode),
    progress: String(projection.progressPercent ?? 0),
  });
  let statusText = "";
  if (projection.phase === "loading-model") statusText = loadingText;
  else if (projection.phase === "processing") statusText = m.removingBackground();
  else if (projection.phase === "preparing") statusText = m.preparing();
  let admissionErrorText = m.editorV2InvalidImage();
  if (projection.admissionError === "unsupported-file")
    admissionErrorText = m.uploadUnsupported({ format: "unknown" });
  else if (projection.admissionError === "exceeds-size-limit")
    admissionErrorText = m.uploadTooLarge();
  else if (projection.admissionError === "multiple-files")
    admissionErrorText = m.uploadSingleOnly();

  return (
    <div
      data-testid="tool-workspace"
      data-main-page-phase={projection.phase}
      className={`tool-workspace-grid ${emptyLike ? "tool-workspace-idle" : ""} ${batchActive ? "tool-workspace-batch" : ""}`}
    >
      <div aria-live="polite" role="status" className="sr-only">
        {statusText}
      </div>

      {emptyLike ? (
        <div
          className="[grid-area:intro] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
          data-testid="home-empty-intro"
        >
          <MainPageIntro />
        </div>
      ) : null}

      {projection.fallbackUsed && !emptyLike ? (
        <Typography
          variant="body-small"
          as="p"
          role="status"
          className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 [grid-area:notice]"
        >
          {m.processingFallbackNotice()}
        </Typography>
      ) : null}

      {batchActive && batch !== null ? (
        <div className="[grid-area:batch]">
          <MainPageBatchRail batch={batch.projection} onIntent={batch.onIntent} />
        </div>
      ) : null}

      {!emptyLike ? (
        <div className="min-w-0 overflow-hidden [grid-area:toolbar]">
          <EditorToolbar
            onBack={() => {
              if (batchActive && batch !== null) batch.onIntent({ type: "clear-batch" });
              else props.onIntent({ type: busy ? "cancel" : "reset" });
            }}
            downloadSlot={
              projection.phase === "result" ? (
                <DownloadSplitControl
                  busy={projection.exportStatus === "preparing"}
                  error={projection.exportError}
                  onDownload={() => props.onIntent({ type: "download-selected" })}
                  onRetry={() => props.onIntent({ type: "download-selected" })}
                  onSelectSize={(size) =>
                    props.onIntent({ type: "choose-export-size", size })
                  }
                  onUseOriginal={() =>
                    props.onIntent({ type: "choose-export-size", size: "original" })
                  }
                  selectedSize={selectedExportSize}
                  sizes={exportSizes}
                />
              ) : undefined
            }
            statusSlot={
              <LocalExecutionReadout
                busy={busy}
                inferencePath={projection.inferencePath}
              />
            }
            workspaceActionsSlot={
              batchActive && batch !== null ? (
                <MainPageBatchActions
                  batch={batch.projection}
                  disabled={busy}
                  onBatchIntent={batch.onIntent}
                  onEditorIntent={props.onIntent}
                  qualityMode={projection.qualityMode}
                />
              ) : undefined
            }
          />
        </div>
      ) : null}

      {projection.phase === "error" && !emptyLike && !batchActive ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive [grid-area:error]"
        >
          <Typography variant="body-small" as="p" className="leading-5 text-destructive">
            {m.editorV2RuntimeFailure()}
          </Typography>
          <div className="flex gap-2">
            {projection.retryable ? (
              <Button variant="outline" onClick={() => props.onIntent({ type: "retry" })}>
                {m.tryAgain()}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => props.onIntent({ type: "reset" })}>
              {m.reset()}
            </Button>
          </div>
        </div>
      ) : null}

      {emptyLike ? (
        <div className="[grid-area:surface]">
          <MainPageEmptySurface
            qualitySlot={
              <QualityModeToggle
                qualityMode={projection.qualityMode}
                onQualityModeChange={(mode) =>
                  props.onIntent({ type: "choose-quality", mode })
                }
                disabled={busy}
              />
            }
            uploadDropzoneSlot={
              <FileDropzone
                className="command-deck-dropzone border border-border bg-background/50 backdrop-blur-sm"
                disabled={busy}
                multiple
                onFiles={(files) => props.onIntent({ type: "choose-files", files })}
              />
            }
            uploadButtonSlot={
              <ChooseFilesButton
                disabled={busy}
                multiple
                onFiles={(files) => props.onIntent({ type: "choose-files", files })}
              />
            }
            errorSlot={
              projection.phase === "error" ? (
                <div
                  role="alert"
                  className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
                >
                  <Typography
                    variant="body-small"
                    as="p"
                    className="leading-5 text-destructive"
                  >
                    {admissionErrorText}
                  </Typography>
                  <Button
                    type="button"
                    variant="outline"
                    className="self-start"
                    onClick={() => props.onIntent({ type: "reset" })}
                  >
                    {m.tryAgain()}
                  </Button>
                </div>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="[grid-area:surface]">
            <EditorStage documentId="main-page-v2" loading={busy}>
              {batchActive && projection.sourcePreviewUrl === null ? (
                <p className="max-w-sm text-center text-sm text-muted-foreground">
                  {m.batchEditorEmpty()}
                </p>
              ) : (
                <MainPageStageContent projection={projection} loadingText={loadingText} />
              )}
            </EditorStage>
          </div>
          <div className="[grid-area:rail]">
            {projection.phase === "result" ? (
              <MainPageResultRail projection={projection} onIntent={props.onIntent} />
            ) : (
              <Skeleton className="min-h-[clamp(22rem,62dvh,46rem)] rounded-lg border border-border" />
            )}
          </div>
        </>
      )}
    </div>
  );
}
