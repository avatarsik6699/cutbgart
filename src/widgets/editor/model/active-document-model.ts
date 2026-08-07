import type { DocumentMachineTypes } from "@/editor/application";
import type { AutomaticModelMode } from "@/shared/lib";

import type { EditorModel } from "./editor-model";

export type EditorToolId = "cutout" | "enhance" | "background";
export type CutoutPresentationMode = "magic" | "manual";

export type ActiveDocumentViewSnapshot = Readonly<{
  activeTool: EditorToolId;
  cutoutMode: CutoutPresentationMode;
  pendingNavigation:
    | Readonly<{ type: "tool"; tool: EditorToolId }>
    | Readonly<{ type: "cutout-mode"; mode: CutoutPresentationMode }>
    | Readonly<{ type: "leave" }>
    | Readonly<{ type: "reprocess"; modelMode: AutomaticModelMode }>
    | null;
}>;

type PendingNavigation = NonNullable<ActiveDocumentViewSnapshot["pendingNavigation"]>;

export class ActiveDocumentModel {
  readonly actor: DocumentMachineTypes.ActorRef;
  readonly editor: EditorModel;

  private readonly listeners = new Set<() => void>();
  private defaultToolRequested = false;
  private draftHistoryCommands: Readonly<{ redo(): void; undo(): void }> | null = null;
  private view: ActiveDocumentViewSnapshot;

  readonly viewStore = {
    getSnapshot: (): ActiveDocumentViewSnapshot => this.view,
    subscribe: (listener: () => void): (() => void) => {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    },
  };

  constructor(editor: EditorModel, actor: DocumentMachineTypes.ActorRef) {
    this.actor = actor;
    this.editor = editor;
    const draft = actor.getSnapshot().context.document.activeDraft;
    let activeTool: EditorToolId = "cutout";
    if (draft?.kind === "background") activeTool = "background";
    else if (draft?.kind === "enhance") activeTool = "enhance";
    this.view = {
      activeTool,
      cutoutMode: draft?.kind === "manual-cutout" ? "manual" : "magic",
      pendingNavigation: null,
    };
  }

  registerDraftHistory(commands: Readonly<{ redo(): void; undo(): void }>): () => void {
    this.draftHistoryCommands = commands;
    return () => {
      if (this.draftHistoryCommands === commands) this.draftHistoryCommands = null;
    };
  }

  requestTool(tool: EditorToolId): void {
    if (tool === this.view.activeTool) return;
    this.requestNavigation({ type: "tool", tool });
  }

  requestCutoutMode(mode: CutoutPresentationMode): void {
    if (this.view.activeTool === "cutout" && mode === this.view.cutoutMode) return;
    this.requestNavigation({ type: "cutout-mode", mode });
  }

  requestLeave(): void {
    this.requestNavigation({ type: "leave" });
  }

  requestModel(modelMode: AutomaticModelMode): void {
    if (
      this.actor.getSnapshot().context.document.committed?.automaticModelMode ===
      modelMode
    )
      return;
    this.requestNavigation({ type: "reprocess", modelMode });
  }

  keepEditing(): void {
    this.updateView({ pendingNavigation: null });
  }

  discardAndContinue(): void {
    const navigation = this.view.pendingNavigation;
    if (navigation === null) return;
    this.updateView({ pendingNavigation: null });
    this.completeNavigation(navigation);
  }

  ensureSelectedToolOpen(): void {
    const document = this.actor.getSnapshot().context.document;
    if (document.activeDraft !== null) {
      this.defaultToolRequested = false;
      return;
    }
    if (document.status !== "result" || this.defaultToolRequested) return;
    this.defaultToolRequested = true;
    this.startSelectedTool();
  }

  undoDocument(): void {
    this.closeCleanDraft();
    this.editor.session.undoDocument();
  }

  redoDocument(): void {
    this.closeCleanDraft();
    this.editor.session.redoDocument();
  }

  undoDraft(): void {
    this.draftHistoryCommands?.undo();
  }

  redoDraft(): void {
    this.draftHistoryCommands?.redo();
  }

  cancelActiveDraft(): void {
    const draft = this.actor.getSnapshot().context.document.activeDraft;
    if (draft?.kind === "manual-cutout") this.editor.session.cancelManual();
    else if (draft?.kind === "magic-cutout") this.editor.session.cancelMagic();
    else if (draft?.kind === "background") this.editor.session.cancelBackground();
    else if (draft?.kind === "enhance") this.editor.session.cancelEnhancements();
  }

  private requestNavigation(navigation: PendingNavigation): void {
    if (this.actor.getSnapshot().context.document.activeDraft?.dirty === true) {
      this.updateView({ pendingNavigation: navigation });
      return;
    }
    this.completeNavigation(navigation);
  }

  private completeNavigation(navigation: PendingNavigation): void {
    this.cancelActiveDraft();
    if (navigation.type === "tool") {
      this.updateView({ activeTool: navigation.tool });
      this.startSelectedTool();
      return;
    }
    if (navigation.type === "cutout-mode") {
      this.updateView({ activeTool: "cutout", cutoutMode: navigation.mode });
      this.startSelectedTool();
      return;
    }
    if (navigation.type === "reprocess") {
      this.editor.reprocessCurrentModel(navigation.modelMode);
      return;
    }
    this.editor.leaveDocument();
  }

  private startSelectedTool(): void {
    if (this.view.activeTool === "background") this.editor.session.beginBackground();
    else if (this.view.activeTool === "enhance") this.editor.session.beginEnhancements();
    else if (this.view.cutoutMode === "manual") this.editor.session.beginManual();
    else this.editor.session.beginMagic();
  }

  private closeCleanDraft(): void {
    const draft = this.actor.getSnapshot().context.document.activeDraft;
    if (draft !== null && !draft.dirty) this.cancelActiveDraft();
  }

  private updateView(next: Partial<ActiveDocumentViewSnapshot>): void {
    const candidate = { ...this.view, ...next };
    if (
      candidate.activeTool === this.view.activeTool &&
      candidate.cutoutMode === this.view.cutoutMode &&
      candidate.pendingNavigation === this.view.pendingNavigation
    )
      return;
    this.view = candidate;
    for (const listener of this.listeners) listener();
  }
}
