import { useCallback, useState } from "react";

import { ModelStorageTrigger } from "@/features/model-storage";
import { getLocale } from "@/paraglide/runtime";
import { useAutomaticModelMode } from "@/shared/lib";
import { SiteShell } from "@/shared/ui";
import {
  MainPageEditorView,
  useEditorSession,
  type ExportSize,
  type MainPageEditorIntent,
  type MainPageEditorProjection,
} from "@/v2/presentation";
import type { EditorImportError, EditorSessionOptions } from "@/v2/runtime-browser";
import { useIsHydrated } from "@/v2/shared/lib";

import { EditorV2MainPageActive } from "./editor-v2-main-page-active";
import { MainPageDiagnosticsPortal } from "./main-page-diagnostics-portal";

type Props = {
  sessionOptions?: EditorSessionOptions;
};

export function EditorV2Page(props: Props) {
  const editor = useEditorSession(props.sessionOptions);
  const hydrated = useIsHydrated();
  const automaticModel = useAutomaticModelMode("isnet-q8");
  const [exportSize, setExportSize] = useState<ExportSize>("original");
  const [admissionError, setAdmissionError] = useState<
    EditorImportError | "multiple-files" | null
  >(null);
  const [restoreFocusTool, setRestoreFocusTool] =
    useState<MainPageEditorProjection["restoreFocusTool"]>(null);
  const locale = getLocale();

  const admitFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length !== 1) {
        setAdmissionError("multiple-files");
        return;
      }
      setAdmissionError(null);
      await editor.session.importImage(files[0]!, automaticModel.qualityMode);
    },
    [automaticModel.qualityMode, editor.session],
  );

  let inactivePhase: MainPageEditorProjection["phase"] = "empty";
  if (admissionError !== null || editor.snapshot.error !== null) inactivePhase = "error";
  else if (editor.snapshot.kind === "preparing") inactivePhase = "preparing";

  const onIntent = useCallback(
    (intent: MainPageEditorIntent) => {
      if (intent.type === "choose-quality") {
        automaticModel.setQualityMode(intent.mode);
      } else if (intent.type === "choose-files") {
        void admitFiles(intent.files);
      } else if (intent.type === "cancel") {
        editor.session.cancel();
      } else if (intent.type === "retry") {
        editor.session.retry(automaticModel.qualityMode);
      } else if (intent.type === "reset") {
        setAdmissionError(null);
        setExportSize("original");
        setRestoreFocusTool(null);
        editor.session.reset();
      } else if (intent.type === "choose-export-size") {
        setExportSize(intent.size);
      } else if (intent.type === "download-selected") {
        void editor.session.exportPng(exportSize);
      } else if (intent.type === "begin-manual") {
        setRestoreFocusTool("manual");
        editor.session.beginManual();
      } else if (intent.type === "begin-magic") {
        setRestoreFocusTool("magic");
        editor.session.beginMagic();
      } else if (intent.type === "begin-background") {
        setRestoreFocusTool("background");
        editor.session.beginBackground();
      } else if (intent.type === "begin-enhancements") {
        setRestoreFocusTool("enhancements");
        editor.session.beginEnhancements();
      } else if (intent.type === "undo-document") {
        editor.session.undoDocument();
      } else if (intent.type === "redo-document") {
        editor.session.redoDocument();
      } else if (intent.type === "focus-restored") {
        setRestoreFocusTool(null);
      }
    },
    [admitFiles, automaticModel, editor.session, exportSize],
  );

  const projection: MainPageEditorProjection = {
    admissionError: admissionError ?? editor.snapshot.error,
    canRedoDocument: false,
    canUndoDocument: false,
    exportError: null,
    exportStatus: "idle",
    fallbackUsed: false,
    height: null,
    inferencePath: "wasm",
    locale,
    phase: inactivePhase,
    qualityMode: automaticModel.qualityMode,
    exportSize,
    progressPercent: null,
    retryable: false,
    restoreFocusTool: null,
    revision: 0,
    sourcePreviewUrl: null,
    committedResultUrl: null,
    width: null,
  };

  return (
    <SiteShell headerUtilitySlot={<ModelStorageTrigger />} homeNavigationActive>
      <MainPageDiagnosticsPortal />
      <main
        data-testid="home-page"
        data-hydrated={hydrated}
        data-artifact-count={editor.session.resources().artifacts}
        data-lease-count={editor.session.resources().leases}
        data-object-url-count={editor.session.resources().objectUrls}
        className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12"
      >
        {editor.snapshot.kind === "document" ? (
          <EditorV2MainPageActive
            exportSize={exportSize}
            locale={locale}
            onIntent={onIntent}
            qualityMode={automaticModel.qualityMode}
            restoreFocusTool={restoreFocusTool}
            session={editor.session}
            snapshot={editor.snapshot}
          />
        ) : (
          <MainPageEditorView projection={projection} onIntent={onIntent} />
        )}
      </main>
    </SiteShell>
  );
}
