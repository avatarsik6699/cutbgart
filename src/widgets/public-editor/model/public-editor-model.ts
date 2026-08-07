import { m } from "@/paraglide/messages";
import { safeLs } from "@/shared/lib/storage";
import { trackEvent } from "@/shared/lib/analytics";
import type { AutomaticModelMode } from "@/shared/lib";
import type { ExportSize, WorkspaceItemId, DocumentId } from "@/v2/domain";
import { createEditorSession, type EditorSessionTypes } from "@/v2/runtime-browser";

import { planImageAdmission } from "./public-editor-policies";

const QUALITY_MODE_STORAGE_KEY = "qualityMode";

export type PublicEditorViewSnapshot = Readonly<{
  batchAdmissionError: Readonly<{
    code: "capacity-exceeded";
    rejectedCount: number;
  }> | null;
  batchMode: boolean;
  exportSize: ExportSize;
  qualityMode: AutomaticModelMode;
  restoreFocusTool: "manual" | "magic" | "background" | "enhancements" | null;
}>;

function storedQualityMode(): AutomaticModelMode | null {
  const stored = safeLs.getItem(QUALITY_MODE_STORAGE_KEY);
  if (stored === "fast") return "isnet-q8";
  if (stored === "max") return "isnet-fp32";
  return null;
}

export class PublicEditorModel {
  readonly session: EditorSessionTypes.Session;

  private readonly viewListeners = new Set<() => void>();
  private view: PublicEditorViewSnapshot = {
    batchAdmissionError: null,
    batchMode: false,
    exportSize: "original",
    qualityMode: "isnet-q8",
    restoreFocusTool: null,
  };

  constructor(options?: EditorSessionTypes.Options) {
    this.session = createEditorSession(options);
  }

  readonly subscribeView = (listener: () => void): (() => void) => {
    this.viewListeners.add(listener);
    return () => this.viewListeners.delete(listener);
  };

  readonly getViewSnapshot = (): PublicEditorViewSnapshot => this.view;

  readonly hydrate = (): void => {
    const qualityMode = storedQualityMode();
    if (qualityMode !== null) this.updateView({ qualityMode });
  };

  readonly dispose = (): Promise<void> => this.session.dispose();

  readonly chooseQualityMode = (qualityMode: AutomaticModelMode): void => {
    this.updateView({ qualityMode });
    if (qualityMode === "isnet-q8") safeLs.setItem(QUALITY_MODE_STORAGE_KEY, "fast");
    else if (qualityMode === "isnet-fp32")
      safeLs.setItem(QUALITY_MODE_STORAGE_KEY, "max");
  };

  readonly chooseExportSize = (exportSize: ExportSize): void => {
    this.updateView({ exportSize });
  };

  readonly admitFiles = async (files: readonly File[]): Promise<void> => {
    if (files.length === 0) return;
    const workspace = this.session.workspaceSnapshot();
    const plan = planImageAdmission(workspace.items.length, files.length);
    this.updateView({
      batchAdmissionError:
        plan.rejectedCount > 0
          ? { code: "capacity-exceeded", rejectedCount: plan.rejectedCount }
          : null,
      batchMode: this.view.batchMode || plan.entersBatchMode,
    });
    await this.session.importImages(files, this.view.qualityMode);
  };

  readonly cancelProcessing = (): void => this.session.cancel();

  readonly retryProcessing = (): void => this.session.retry(this.view.qualityMode);

  readonly reset = (): void => {
    this.resetView();
    this.session.reset();
  };

  readonly downloadSelected = (): void => {
    void this.session
      .exportPng(this.view.exportSize)
      .then(() => trackEvent("download_clicked"));
  };

  readonly beginManual = (): void => {
    this.updateView({ restoreFocusTool: "manual" });
    this.session.beginManual();
  };

  readonly beginMagic = (): void => {
    this.updateView({ restoreFocusTool: "magic" });
    this.session.beginMagic();
  };

  readonly beginBackground = (): void => {
    this.updateView({ restoreFocusTool: "background" });
    this.session.beginBackground();
  };

  readonly beginEnhancements = (): void => {
    this.updateView({ restoreFocusTool: "enhancements" });
    this.session.beginEnhancements();
  };

  readonly markToolFocusRestored = (): void => {
    this.updateView({ restoreFocusTool: null });
  };

  readonly undoDocument = (): void => this.session.undoDocument();

  readonly redoDocument = (): void => this.session.redoDocument();

  readonly selectBatchDocument = (documentId: DocumentId): void => {
    this.session.selectDocument(documentId);
  };

  readonly retryBatchItem = (itemId: WorkspaceItemId): void => {
    void this.session.retryItem(itemId);
  };

  readonly removeBatchItem = (itemId: WorkspaceItemId): void => {
    const workspace = this.session.workspaceSnapshot();
    const selected = workspace.items.find(
      (item) =>
        item.itemId === itemId && item.documentId === workspace.selectedDocumentId,
    );
    if (selected !== undefined && this.activeDocumentNeedsGuard()) {
      if (!globalThis.confirm(m.editorV2RemoveGuard())) return;
    }
    this.session.removeItem(itemId);
    if (workspace.items.length <= 1) {
      this.updateView({ batchAdmissionError: null, batchMode: false });
    }
  };

  readonly downloadBatchItem = (documentId: DocumentId): void => {
    this.session.exportItemPng(documentId);
    trackEvent("download_clicked");
  };

  readonly downloadAll = (): void => {
    void this.session.exportAll().then(() => trackEvent("download_clicked"));
  };

  readonly cancelDownloadAll = (): void => this.session.cancelExportAll();

  readonly clearBatch = (): void => {
    if (this.activeDocumentNeedsGuard() && !globalThis.confirm(m.editorV2RemoveGuard()))
      return;
    const items = this.session.workspaceSnapshot().items;
    for (const item of items) this.session.removeItem(item.itemId);
    this.resetView();
  };

  readonly leaveDocument = (): void => {
    if (this.view.batchMode) {
      this.clearBatch();
      return;
    }
    this.reset();
  };

  private activeDocumentNeedsGuard(): boolean {
    const snapshot = this.session.getSnapshot();
    if (snapshot.kind !== "document") return false;
    const document = snapshot.actor.getSnapshot().context.document;
    return (
      document.activeDraft?.dirty === true ||
      !["ready", "result", "error"].includes(document.status)
    );
  }

  private resetView(): void {
    this.updateView({
      batchAdmissionError: null,
      batchMode: false,
      exportSize: "original",
      restoreFocusTool: null,
    });
  }

  private updateView(next: Partial<PublicEditorViewSnapshot>): void {
    const candidate = { ...this.view, ...next };
    if (
      candidate.batchAdmissionError === this.view.batchAdmissionError &&
      candidate.batchMode === this.view.batchMode &&
      candidate.exportSize === this.view.exportSize &&
      candidate.qualityMode === this.view.qualityMode &&
      candidate.restoreFocusTool === this.view.restoreFocusTool
    )
      return;
    this.view = candidate;
    for (const listener of this.viewListeners) listener();
  }
}
