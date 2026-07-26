import { EditorArtifactStore } from "./artifact-store";
import type {
  EditDocument,
  EditDocumentSnapshot,
  EditHistory,
  EditProcessingProvenance,
  EditorAlphaMatte,
  EditorArtifactId,
  EditorAutomaticModelMode,
  EditorBackgroundFill,
  EditorInferencePath,
  EditorSourceImage,
} from "./types";

export interface EditorProcessedImage {
  source: EditorSourceImage;
  result: Blob;
  cutout?: Blob;
  foreground?: Blob;
  qualityMode: EditorAutomaticModelMode | "fast" | "max";
  alphaMatte?: EditorAlphaMatte;
  backgroundFill?: EditorBackgroundFill;
  backgroundPending?: boolean;
}

export interface EditDocumentScope {
  document: EditDocument;
  history: EditHistory;
  artifacts: EditorArtifactStore;
  /** Stable ownership token for tool workers attached to this document. */
  workerOwnerId: string;
}

export interface CreateEditDocumentOptions {
  id?: string;
  workerOwnerId?: string;
  inferencePath?: EditorInferencePath | null;
  createdAt?: number;
  artifacts?: EditorArtifactStore;
}

function createId(prefix: string): string {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}

export function normalizeAutomaticMode(
  mode: EditorProcessedImage["qualityMode"],
): EditorAutomaticModelMode {
  if (mode === "max") return "isnet-fp32";
  if (mode === "fast") return "isnet-q8";
  return mode;
}

export function artifactIdsForSnapshot(
  snapshot: Readonly<EditDocumentSnapshot>,
  artifacts: EditorArtifactStore,
): readonly EditorArtifactId[] {
  const ids: EditorArtifactId[] = [snapshot.alphaMatte, snapshot.composite];
  if (snapshot.foreground) ids.push(snapshot.foreground);
  if (snapshot.backgroundFill.type === "image") {
    const background = artifacts.idOf(snapshot.backgroundFill.blob);
    if (background) ids.push(background);
  }
  return ids;
}

export function createEditDocumentSnapshot(
  image: EditorProcessedImage,
  artifacts: EditorArtifactStore,
  provenance?: Partial<EditProcessingProvenance>,
): Readonly<EditDocumentSnapshot> {
  if (!image.alphaMatte) throw new Error("An edit document requires an alpha matte");
  const processingMode = normalizeAutomaticMode(image.qualityMode);
  const alphaMatte = artifacts.add("alpha-matte", image.alphaMatte);
  const composite = artifacts.add("composite", image.result);
  const foreground = image.foreground
    ? artifacts.add("foreground", image.foreground)
    : null;
  if (image.backgroundFill?.type === "image")
    artifacts.add("background-image", image.backgroundFill.blob);
  const backgroundFill: EditorBackgroundFill = image.backgroundFill ?? {
    type: "transparent",
  };
  return Object.freeze({
    alphaMatte,
    foreground,
    composite,
    backgroundFill,
    processingMode,
    provenance: Object.freeze({
      mode: provenance?.mode ?? processingMode,
      inferencePath: provenance?.inferencePath ?? null,
      createdAt: provenance?.createdAt ?? Date.now(),
    }),
  });
}

export function createEditDocumentScope(
  image: EditorProcessedImage,
  options: CreateEditDocumentOptions = {},
): EditDocumentScope {
  const artifacts = options.artifacts ?? new EditorArtifactStore();
  const snapshot = createEditDocumentSnapshot(image, artifacts, {
    inferencePath: options.inferencePath,
    createdAt: options.createdAt,
  });
  const document: EditDocument = {
    id: options.id ?? createId("edit-document"),
    source: image.source,
    baseline: snapshot,
    current: snapshot,
    revision: 0,
  };
  const scope: EditDocumentScope = {
    document,
    history: { past: [], future: [], retainedHistoricalBytes: 0 },
    artifacts,
    workerOwnerId: options.workerOwnerId ?? createId("edit-worker"),
  };
  artifacts.replaceOwner("baseline", artifactIdsForSnapshot(snapshot, artifacts));
  artifacts.replaceOwner("current", artifactIdsForSnapshot(snapshot, artifacts));
  return scope;
}

export function resolveEditDocumentImage(scope: EditDocumentScope): EditorProcessedImage {
  const { current } = scope.document;
  const alphaMatte = scope.artifacts.getValue<EditorAlphaMatte>(current.alphaMatte);
  const result = scope.artifacts.getValue<Blob>(current.composite);
  const foreground = current.foreground
    ? scope.artifacts.getValue<Blob>(current.foreground)
    : null;
  if (!alphaMatte || !result)
    throw new Error("The edit document references a released artifact");
  return {
    source: scope.document.source,
    result,
    cutout:
      current.backgroundFill.type === "transparent" && !foreground ? result : undefined,
    foreground: foreground ?? undefined,
    qualityMode: current.processingMode,
    alphaMatte,
    backgroundFill: current.backgroundFill,
    backgroundPending: false,
  };
}

export function disposeEditDocumentScope(scope: EditDocumentScope): void {
  scope.artifacts.dispose();
}
