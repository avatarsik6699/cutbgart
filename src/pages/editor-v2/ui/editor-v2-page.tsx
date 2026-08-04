import { useCallback, useState } from "react";

import { ModelStorageTrigger } from "@/features/model-storage";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { useAutomaticModelMode } from "@/shared/lib";
import { SiteShell } from "@/shared/ui";
import {
  MainPageEditorView,
  useEditorSession,
  type BatchMainPageIntent,
  type BatchMainPageProjection,
  type ExportSize,
  type MainPageEditorIntent,
  type MainPageEditorProjection,
} from "@/v2/presentation";
import type {
  EditorImportError,
  EditorSessionOptions,
  WorkspaceItemSummary,
} from "@/v2/runtime-browser";
import { useIsHydrated } from "@/v2/shared/lib";

import { EditorV2MainPageActive } from "./editor-v2-main-page-active";
import { MainPageDiagnosticsPortal } from "./main-page-diagnostics-portal";

type Props = {
  sessionOptions?: EditorSessionOptions;
};

function batchError(
  item: WorkspaceItemSummary,
): { message: string; retryable: boolean } | null {
  if (item.error === null) return null;
  if (typeof item.error !== "string")
    return { message: item.error.message, retryable: item.error.retryable };
  if (item.error === "exceeds-size-limit")
    return { message: m.uploadTooLarge(), retryable: true };
  if (item.error === "unsupported-file")
    return { message: m.uploadUnsupported({ format: "unknown" }), retryable: true };
  return { message: m.editorV2InvalidImage(), retryable: true };
}

export function EditorV2Page(props: Props) {
  const editor = useEditorSession(props.sessionOptions);
  const hydrated = useIsHydrated();
  const automaticModel = useAutomaticModelMode("isnet-q8");
  const [exportSize, setExportSize] = useState<ExportSize>("original");
  const [admissionError, setAdmissionError] = useState<
    EditorImportError | "multiple-files" | null
  >(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchAdmissionError, setBatchAdmissionError] =
    useState<BatchMainPageProjection["admissionError"]>(null);
  const [restoreFocusTool, setRestoreFocusTool] =
    useState<MainPageEditorProjection["restoreFocusTool"]>(null);
  const locale = getLocale();

  const admitFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;
      const workspace = editor.session.workspaceSnapshot();
      const remaining = Math.max(0, 20 - workspace.items.length);
      const rejectedCount = Math.max(0, files.length - remaining);
      setBatchAdmissionError(
        rejectedCount > 0 ? { code: "capacity-exceeded", rejectedCount } : null,
      );
      if (workspace.items.length + Math.min(files.length, remaining) > 1)
        setBatchMode(true);
      setAdmissionError(null);
      await editor.session.importImages(files, automaticModel.qualityMode);
    },
    [automaticModel.qualityMode, editor.session],
  );

  const batchProjection: BatchMainPageProjection = {
    admissionError: batchAdmissionError,
    capacity: { current: editor.workspace.items.length, limit: 20 },
    counts: {
      active: editor.workspace.items.filter(
        (item) =>
          item.status === "preparing" ||
          item.status === "model-loading" ||
          item.status === "processing",
      ).length,
      queued: editor.workspace.items.filter((item) => item.status === "queued").length,
      completed: editor.workspace.items.filter((item) => item.status === "result").length,
      failed: editor.workspace.items.filter((item) => item.status === "error").length,
    },
    export: editor.workspace.export,
    items: editor.workspace.items.map((item) => ({
      ...item,
      error: batchError(item),
      selected: item.documentId === editor.workspace.selectedDocumentId,
    })),
  };

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

  const onBatchIntent = useCallback(
    (intent: BatchMainPageIntent) => {
      const workspace = editor.session.workspaceSnapshot();
      const snapshot = editor.session.getSnapshot();
      if (intent.type === "add-files") {
        void admitFiles(intent.files);
      } else if (intent.type === "select-item") {
        editor.session.selectDocument(intent.documentId);
      } else if (intent.type === "retry-item") {
        void editor.session.retryItem(intent.itemId);
      } else if (intent.type === "remove-item") {
        const selected = workspace.items.find(
          (item) =>
            item.itemId === intent.itemId &&
            item.documentId === workspace.selectedDocumentId,
        );
        const activeDocument =
          snapshot.kind === "document"
            ? snapshot.actor.getSnapshot().context.document
            : null;
        const guarded =
          selected !== undefined &&
          (activeDocument?.activeDraft?.dirty === true ||
            (activeDocument !== null &&
              !["ready", "result", "error"].includes(activeDocument.status)));
        if (guarded && !globalThis.confirm(m.editorV2RemoveGuard())) return;
        editor.session.removeItem(intent.itemId);
        if (workspace.items.length <= 1) {
          setBatchMode(false);
          setBatchAdmissionError(null);
        }
      } else if (intent.type === "download-item") {
        editor.session.exportItemPng(intent.documentId);
      } else if (intent.type === "download-all") {
        void editor.session.exportAll();
      } else if (intent.type === "cancel-download-all") {
        editor.session.cancelExportAll();
      } else if (intent.type === "clear-batch") {
        const activeDocument =
          snapshot.kind === "document"
            ? snapshot.actor.getSnapshot().context.document
            : null;
        const guarded =
          activeDocument?.activeDraft?.dirty === true ||
          (activeDocument !== null &&
            !["ready", "result", "error"].includes(activeDocument.status));
        if (guarded && !globalThis.confirm(m.editorV2RemoveGuard())) return;
        for (const item of workspace.items) editor.session.removeItem(item.itemId);
        setAdmissionError(null);
        setBatchAdmissionError(null);
        setBatchMode(false);
        setExportSize("original");
        setRestoreFocusTool(null);
      }
    },
    [admitFiles, editor.session],
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
            batch={batchMode ? batchProjection : undefined}
            exportSize={exportSize}
            locale={locale}
            onIntent={onIntent}
            onBatchIntent={batchMode ? onBatchIntent : undefined}
            qualityMode={automaticModel.qualityMode}
            restoreFocusTool={restoreFocusTool}
            session={editor.session}
            snapshot={editor.snapshot}
          />
        ) : (
          <MainPageEditorView
            batch={batchMode ? batchProjection : undefined}
            onBatchIntent={batchMode ? onBatchIntent : undefined}
            projection={projection}
            onIntent={onIntent}
          />
        )}
      </main>
    </SiteShell>
  );
}
