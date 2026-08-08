import type { DocumentMachineTypes } from "@/editor/application";
import type {
  BackgroundTypes,
  DocumentId,
  EnhancementTypes,
  MagicCandidateId,
  MagicCutoutTypes,
  DocumentHistoryTypes,
} from "@/editor/domain";

import {
  CUTOUT_BRUSH_DIAMETER_DEFAULT_MAGIC,
  CUTOUT_BRUSH_DIAMETER_DEFAULT_MANUAL,
} from "@/shared/lib";

import { BackgroundController } from "../background";
import { EnhancementController } from "../enhancements";
import { MagicCutoutController } from "../magic-cutout";
import { ManualCutoutController } from "../manual-cutout";
import { DocumentResultProjection } from "./document-result-projection";
import type { EditorSessionTypes } from "./editor-session.types";

type ManualViewState = {
  mode: DocumentHistoryTypes.ManualMode;
  brushSize: number;
  zoom: number;
};
type MagicViewState = { mode: MagicCutoutTypes.Mode; radius: number };

export class DocumentRuntime {
  readonly #actor: DocumentMachineTypes.ActorRef;
  readonly #background: BackgroundController;
  readonly #dependencies: EditorSessionTypes.Dependencies;
  readonly #documentId: DocumentId;
  readonly #enhancements: EnhancementController;
  readonly #magic: MagicCutoutController;
  readonly #manual: ManualCutoutController;
  readonly #onDocumentChange: () => void;
  readonly #onChange: () => void;
  readonly #projection: DocumentResultProjection;
  readonly #stops: (() => void)[] = [];
  #snapshot: EditorSessionTypes.ActiveSnapshot;
  #disposed = false;
  #manualView: ManualViewState = {
    mode: "erase",
    brushSize: CUTOUT_BRUSH_DIAMETER_DEFAULT_MANUAL,
    zoom: 1,
  };
  #magicView: MagicViewState = {
    mode: "keep",
    radius: CUTOUT_BRUSH_DIAMETER_DEFAULT_MAGIC / 2,
  };

  constructor(options: {
    actor: DocumentMachineTypes.ActorRef;
    dependencies: EditorSessionTypes.Dependencies;
    documentId: DocumentId;
    fileName: string;
    height: number;
    onChange(): void;
    onDocumentChange(): void;
    previewUrl: string | null;
    width: number;
  }) {
    this.#actor = options.actor;
    this.#dependencies = options.dependencies;
    this.#documentId = options.documentId;
    this.#onChange = () => options.onChange();
    this.#onDocumentChange = () => options.onDocumentChange();
    const currentActor = () => (this.#disposed ? null : this.#actor);
    this.#manual = new ManualCutoutController({
      actor: currentActor,
      documentId: () => this.#documentId,
      drafts: options.dependencies.manualDrafts,
      repository: options.dependencies.repository,
    });
    this.#magic = new MagicCutoutController({
      actor: currentActor,
      candidates: options.dependencies.magicCandidates,
      dimensions: () => ({ width: options.width, height: options.height }),
      documentId: () => this.#documentId,
      drafts: options.dependencies.magicDrafts,
      nextRunId: options.dependencies.ids.run,
    });
    this.#background = new BackgroundController({
      actor: currentActor,
      drafts: options.dependencies.backgroundDrafts,
      images: options.dependencies.backgroundImages,
    });
    this.#enhancements = new EnhancementController({
      actor: currentActor,
      drafts: options.dependencies.enhancementDrafts,
      nextRunId: options.dependencies.ids.run,
      service: options.dependencies.enhancementServiceFor(options.documentId),
    });
    this.#snapshot = {
      kind: "document",
      actor: this.#actor,
      backgroundRuntime: this.#background.getSnapshot(),
      enhancementRuntime: this.#enhancements.getSnapshot(),
      error: null,
      fileName: options.fileName,
      foregroundUrl: null,
      height: options.height,
      magicProgress: null,
      originalUrl: null,
      previewUrl: options.previewUrl,
      resultUrl: null,
      width: options.width,
    };
    this.#projection = new DocumentResultProjection(options.dependencies.repository);
    this.#projection.watch(
      this.#actor,
      this.#documentId,
      (resultUrl, foregroundUrl, originalUrl) => {
        if (this.#disposed) return;
        if (this.#actor.getSnapshot().context.document.activeDraft === null) {
          options.dependencies.manualDrafts.releaseDocument(this.#documentId);
          options.dependencies.magicDrafts.releaseDocument(this.#documentId);
          options.dependencies.magicCandidates.releaseDocument(this.#documentId);
        }
        this.#snapshot = { ...this.#snapshot, resultUrl, foregroundUrl, originalUrl };
        this.#onChange();
      },
    );
    this.#stops.push(
      this.#background.subscribe(() => this.#publishControllerState()),
      this.#enhancements.subscribe(() => this.#publishControllerState()),
    );
    const subscription = this.#actor.subscribe(() => {
      this.#background.reconcile();
      this.#enhancements.reconcile();
      this.#publishControllerState();
      this.#onDocumentChange();
    });
    this.#stops.push(() => subscription.unsubscribe());
  }

  get actor(): DocumentMachineTypes.ActorRef {
    return this.#actor;
  }

  get documentId(): DocumentId {
    return this.#documentId;
  }

  getSnapshot(): EditorSessionTypes.ActiveSnapshot {
    return this.#snapshot;
  }

  setMagicProgress(progress: EditorSessionTypes.ActiveSnapshot["magicProgress"]): void {
    if (this.#disposed) return;
    this.#snapshot = { ...this.#snapshot, magicProgress: progress };
    this.#onChange();
  }

  applyBackground(): void {
    this.#background.apply();
  }
  applyEnhancements(): void {
    this.#enhancements.apply();
  }
  applyMagic(): void {
    this.#magic.apply();
  }
  applyManual(): void {
    this.#manual.apply();
  }
  beginBackground(): void {
    this.#background.begin();
  }
  beginEnhancements(): void {
    this.#enhancements.begin();
  }
  beginMagic(): void {
    this.#magic.begin();
  }
  beginManual(): void {
    this.#manual.begin();
  }
  cancelBackground(): void {
    this.#background.cancel();
  }
  cancelEnhancements(): void {
    this.#enhancements.cancel();
  }
  cancelMagic(): void {
    this.#magic.cancel();
  }
  cancelManual(): void {
    this.#manual.cancel();
  }
  changeBackground(fill: BackgroundTypes.FillDescriptor): void {
    this.#background.change(fill);
  }
  changeEnhancements(ids: readonly EnhancementTypes.OperationId[]): void {
    this.#enhancements.change(ids);
  }
  manualDraft(): ReturnType<ManualCutoutController["draft"]> {
    return this.#manual.draft();
  }
  magicDraft(): ReturnType<MagicCutoutController["draft"]> {
    return this.#magic.draft();
  }
  manualViewState(): Readonly<ManualViewState> {
    return this.#manualView;
  }
  setManualViewState(state: Readonly<ManualViewState>): void {
    this.#manualView = { ...state };
  }
  magicViewState(): Readonly<MagicViewState> {
    return this.#magicView;
  }
  setMagicViewState(state: Readonly<MagicViewState>): void {
    this.#magicView = { ...state };
  }
  notifyMagicChanged(): void {
    this.#magic.notifyChanged();
  }
  notifyManualDirty(): void {
    this.#manual.notifyDirty();
  }
  paintMagicCandidate(canvas: HTMLCanvasElement, id: MagicCandidateId | null): void {
    this.#magic.paintCandidate(canvas, id);
  }
  predictMagic(): void {
    this.#magic.predict();
  }
  redoMagic(): void {
    this.#magic.redo();
  }
  redoManual(): void {
    this.#manual.redo();
  }
  retryEnhancements(): void {
    this.#enhancements.retry();
  }
  selectBackgroundImage(file: File): Promise<void> {
    return this.#background.selectImage(file);
  }
  selectMagicCandidate(id: MagicCandidateId): void {
    this.#magic.select(id);
  }
  undoMagic(): void {
    this.#magic.undo();
  }
  undoManual(): void {
    this.#manual.undo();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#projection.stop();
    for (const stop of this.#stops.splice(0)) stop();
    this.#background.reset();
    this.#enhancements.reset();
    this.#dependencies.manualDrafts.releaseDocument(this.#documentId);
    this.#dependencies.magicDrafts.releaseDocument(this.#documentId);
    this.#dependencies.magicCandidates.releaseDocument(this.#documentId);
    this.#dependencies.releaseEnhancementService(this.#documentId);
  }

  #publishControllerState(): void {
    if (this.#disposed) return;
    const backgroundRuntime = this.#background.getSnapshot();
    const enhancementRuntime = this.#enhancements.getSnapshot();
    if (
      backgroundRuntime === this.#snapshot.backgroundRuntime &&
      enhancementRuntime === this.#snapshot.enhancementRuntime
    )
      return;
    this.#snapshot = {
      ...this.#snapshot,
      backgroundRuntime,
      enhancementRuntime,
    };
    this.#onChange();
  }
}
