import { useSelector } from "@xstate/react";

import {
  MainPageBatchActions,
  MainPageBatchRail,
  MainPageEditorView,
  type ExportSize,
  type BatchMainPageIntent,
  type BatchMainPageProjection,
  type MainPageEditorIntent,
  type MainPageEditorProjection,
} from "@/v2/presentation";
import {
  selectCanRedoDocument,
  selectCanUndoDocument,
  selectDocumentProgress,
  selectDocumentRevision,
  selectDocumentStatus,
  type DocumentSnapshotLike,
} from "@/v2/application";
import type { DocumentStatus } from "@/v2/domain";
import type { ActiveEditorSessionSnapshot, EditorSession } from "@/v2/runtime-browser";
import { availableExportSizes, DownloadSplitControl } from "@/features/download-result";

import { EditorV2ActiveDocument } from "./editor-v2-active-document";

export type EditorV2MainPageActiveProps = Readonly<{
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

function phaseForStatus(status: DocumentStatus): MainPageEditorProjection["phase"] {
  if (status === "model-loading") return "loading-model";
  if (status === "result") return "result";
  if (status === "error" || status === "ready") return "error";
  return "processing";
}

function selectHasActiveDraft(snapshot: DocumentSnapshotLike): boolean {
  return snapshot.context.document.activeDraft !== null;
}

export function EditorV2MainPageActive(props: EditorV2MainPageActiveProps) {
  const status = useSelector(props.snapshot.actor, selectDocumentStatus);
  const progress = useSelector(props.snapshot.actor, selectDocumentProgress);
  const revision = useSelector(props.snapshot.actor, selectDocumentRevision);
  const canUndoDocument = useSelector(props.snapshot.actor, selectCanUndoDocument);
  const canRedoDocument = useSelector(props.snapshot.actor, selectCanRedoDocument);
  const draftOpen = useSelector(props.snapshot.actor, selectHasActiveDraft);
  if (draftOpen || status === "result") {
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
          key={props.snapshot.actor.id}
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
    canRedoDocument,
    canUndoDocument,
    exportError: singleExport.error,
    exportStatus: singleExport.status,
    fallbackUsed: processingSelection?.fallbackUsed ?? false,
    height: props.snapshot.height,
    inferencePath: processingSelection?.inferencePath ?? "wasm",
    locale: props.locale,
    phase: phaseForStatus(status),
    qualityMode: props.qualityMode,
    exportSize: props.exportSize,
    progressPercent: progress === null ? null : Math.round(progress * 100),
    retryable: status === "error" || status === "ready",
    restoreFocusTool: props.restoreFocusTool,
    revision,
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
