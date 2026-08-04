import {
  MainPageBatchActions,
  MainPageBatchRail,
  MainPageEditorView,
  useDocumentActorSelectors,
  type ExportSize,
  type BatchMainPageIntent,
  type BatchMainPageProjection,
  type MainPageEditorIntent,
  type MainPageEditorProjection,
} from "@/v2/presentation";
import type { ActiveEditorSessionSnapshot, EditorSession } from "@/v2/runtime-browser";
import { availableExportSizes, DownloadSplitControl } from "@/features/download-result";

import { EditorV2ActiveDocument } from "./editor-v2-active-document";

type Props = Readonly<{
  batch?: BatchMainPageProjection;
  exportSize: ExportSize;
  locale: "ru" | "en";
  onIntent: (intent: MainPageEditorIntent) => void;
  onBatchIntent?: (intent: BatchMainPageIntent) => void;
  qualityMode: MainPageEditorProjection["qualityMode"];
  restoreFocusTool: MainPageEditorProjection["restoreFocusTool"];
  session: EditorSession;
  snapshot: ActiveEditorSessionSnapshot;
}>;

function phaseForStatus(
  status: ReturnType<typeof useDocumentActorSelectors>["status"],
): MainPageEditorProjection["phase"] {
  if (status === "model-loading") return "loading-model";
  if (status === "result") return "result";
  if (status === "error" || status === "ready") return "error";
  return "processing";
}

export function EditorV2MainPageActive(props: Props) {
  const document = useDocumentActorSelectors(props.snapshot.actor);
  const draftOpen =
    document.manualDraft !== null ||
    document.magicDraft !== null ||
    document.backgroundDraft !== null ||
    document.enhancementDraft !== null;
  if (draftOpen || document.status === "result") {
    const sizes = availableExportSizes({
      width: props.snapshot.width,
      height: props.snapshot.height,
    });
    const selectedSize = sizes.includes(props.exportSize) ? props.exportSize : "original";
    const singleExport = props.session.singleExportSnapshot();
    return (
      <div className="space-y-4">
        {props.batch && props.onBatchIntent ? (
          <MainPageBatchRail batch={props.batch} onIntent={props.onBatchIntent} />
        ) : null}
        <EditorV2ActiveDocument
          locale={props.locale}
          onLeave={() => {
            if (props.batch && props.onBatchIntent)
              props.onBatchIntent({ type: "clear-batch" });
            else props.onIntent({ type: "reset" });
          }}
          session={props.session}
          snapshot={props.snapshot}
          downloadSlot={
            <DownloadSplitControl
              busy={singleExport.status === "preparing"}
              error={singleExport.error}
              onDownload={() => props.onIntent({ type: "download-selected" })}
              onRetry={() => props.onIntent({ type: "download-selected" })}
              onSelectSize={(size) =>
                props.onIntent({ type: "choose-export-size", size })
              }
              onUseOriginal={() =>
                props.onIntent({ type: "choose-export-size", size: "original" })
              }
              selectedSize={selectedSize}
              sizes={sizes}
            />
          }
          workspaceActionsSlot={
            props.batch && props.onBatchIntent ? (
              <MainPageBatchActions
                batch={props.batch}
                disabled={false}
                onBatchIntent={props.onBatchIntent}
                onEditorIntent={props.onIntent}
                qualityMode={props.qualityMode}
              />
            ) : undefined
          }
        />
      </div>
    );
  }
  const processingSelection = props.session.processingSelection();
  const singleExport = props.session.singleExportSnapshot();
  const projection: MainPageEditorProjection = {
    admissionError: null,
    canRedoDocument: document.canRedoDocument,
    canUndoDocument: document.canUndoDocument,
    exportError: singleExport.error,
    exportStatus: singleExport.status,
    fallbackUsed: processingSelection?.fallbackUsed ?? false,
    height: props.snapshot.height,
    inferencePath: processingSelection?.inferencePath ?? "wasm",
    locale: props.locale,
    phase: phaseForStatus(document.status),
    qualityMode: props.qualityMode,
    exportSize: props.exportSize,
    progressPercent:
      document.progress === null ? null : Math.round(document.progress * 100),
    retryable: document.status === "error" || document.status === "ready",
    restoreFocusTool: props.restoreFocusTool,
    revision: document.revision,
    sourcePreviewUrl: props.snapshot.previewUrl,
    committedResultUrl: props.snapshot.resultUrl,
    width: props.snapshot.width,
  };
  return (
    <MainPageEditorView
      batch={props.batch}
      onBatchIntent={props.onBatchIntent}
      projection={projection}
      onIntent={props.onIntent}
    />
  );
}
