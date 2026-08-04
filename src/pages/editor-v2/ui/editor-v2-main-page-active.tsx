import {
  MainPageEditorView,
  useDocumentActorSelectors,
  type ExportSize,
  type MainPageEditorIntent,
  type MainPageEditorProjection,
} from "@/v2/presentation";
import type { ActiveEditorSessionSnapshot, EditorSession } from "@/v2/runtime-browser";

import { EditorV2ActiveDocument } from "./editor-v2-active-document";

type Props = Readonly<{
  exportSize: ExportSize;
  locale: "ru" | "en";
  onIntent: (intent: MainPageEditorIntent) => void;
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
  if (draftOpen) {
    return (
      <EditorV2ActiveDocument
        grid="fine"
        session={props.session}
        snapshot={props.snapshot}
      />
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
  return <MainPageEditorView projection={projection} onIntent={props.onIntent} />;
}
