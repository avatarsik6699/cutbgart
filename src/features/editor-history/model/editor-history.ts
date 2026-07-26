import {
  artifactIdsForSnapshot,
  createEditDocumentSnapshot,
  type EditDocumentScope,
  type EditDocumentSnapshot,
  type EditHistory,
  type EditOperation,
  type EditOperationKind,
  type EditorArtifactId,
} from "../../../entities/edit-document";
import type { ProcessedImage } from "../../../entities/processed-image";

export const EDIT_HISTORY_ENTRY_LIMIT = 20;
export const EDIT_HISTORY_BYTE_LIMIT = 96 * 1024 * 1024;

export interface CommitEditOptions {
  kind: EditOperationKind;
  label: string;
}

function createOperationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `edit-${crypto.randomUUID()}`
    : `edit-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
}

function snapshotIds(
  scope: EditDocumentScope,
  snapshot: Readonly<EditDocumentSnapshot>,
): readonly EditorArtifactId[] {
  return artifactIdsForSnapshot(snapshot, scope.artifacts);
}

function historicalIds(
  scope: EditDocumentScope,
  history: Pick<EditHistory, "past" | "future">,
  current: Readonly<EditDocumentSnapshot>,
): Set<EditorArtifactId> {
  const protectedIds = new Set([
    ...snapshotIds(scope, scope.document.baseline),
    ...snapshotIds(scope, current),
  ]);
  const ids = new Set<EditorArtifactId>();
  for (const operation of [...history.past, ...history.future]) {
    for (const id of [
      ...snapshotIds(scope, operation.before),
      ...snapshotIds(scope, operation.after),
    ])
      if (!protectedIds.has(id)) ids.add(id);
  }
  return ids;
}

function retainedBytes(
  scope: EditDocumentScope,
  history: Pick<EditHistory, "past" | "future">,
  current: Readonly<EditDocumentSnapshot>,
): number {
  return scope.artifacts.estimatedBytes(historicalIds(scope, history, current));
}

function withRetainedBytes(
  scope: EditDocumentScope,
  history: Pick<EditHistory, "past" | "future">,
  current: Readonly<EditDocumentSnapshot>,
): EditHistory {
  return {
    past: history.past,
    future: history.future,
    retainedHistoricalBytes: retainedBytes(scope, history, current),
  };
}

export function syncEditDocumentReachability(scope: EditDocumentScope): void {
  synchronize(scope);
}

function synchronize(scope: EditDocumentScope): void {
  const owners = new Map<string, readonly EditorArtifactId[]>([
    ["baseline", artifactIdsForSnapshot(scope.document.baseline, scope.artifacts)],
    ["current", artifactIdsForSnapshot(scope.document.current, scope.artifacts)],
  ]);
  for (const [stack, operations] of [
    ["past", scope.history.past],
    ["future", scope.history.future],
  ] as const)
    operations.forEach((operation, index) =>
      owners.set(`${stack}:${String(index)}:${operation.id}`, [
        ...snapshotIds(scope, operation.before),
        ...snapshotIds(scope, operation.after),
      ]),
    );
  scope.artifacts.replaceAllOwners(owners);
}

function enforceBounds(
  scope: EditDocumentScope,
  history: EditHistory,
  current: Readonly<EditDocumentSnapshot>,
): EditHistory {
  let past = [...history.past].slice(-EDIT_HISTORY_ENTRY_LIMIT);
  let bounded = withRetainedBytes(scope, { past, future: history.future }, current);
  while (past.length > 1 && bounded.retainedHistoricalBytes > EDIT_HISTORY_BYTE_LIMIT) {
    past = past.slice(1);
    bounded = withRetainedBytes(scope, { past, future: history.future }, current);
  }
  return bounded;
}

export function commitProcessedImage(
  scope: EditDocumentScope,
  image: ProcessedImage,
  options: CommitEditOptions,
): EditDocumentScope {
  const before = scope.document.current;
  const after = createEditDocumentSnapshot(image, scope.artifacts, {
    mode: before.processingMode,
    inferencePath: before.provenance.inferencePath,
  });
  const operation: EditOperation = {
    id: createOperationId(),
    kind: options.kind,
    label: options.label,
    before,
    after,
    estimatedHistoricalBytes: scope.artifacts.estimatedBytes(
      snapshotIds(scope, before).filter(
        (id) =>
          !snapshotIds(scope, scope.document.baseline).includes(id) &&
          !snapshotIds(scope, after).includes(id),
      ),
    ),
  };
  const document = {
    ...scope.document,
    current: after,
    revision: scope.document.revision + 1,
  };
  const next = {
    ...scope,
    document,
    history: enforceBounds(
      { ...scope, document },
      {
        past: [...scope.history.past, operation],
        future: [],
        retainedHistoricalBytes: 0,
      },
      after,
    ),
  };
  synchronize(next);
  return next;
}

export function commitProcessedImageIfCurrent(
  scope: EditDocumentScope,
  expectedRevision: number,
  image: ProcessedImage,
  options: CommitEditOptions,
): EditDocumentScope {
  return scope.document.revision === expectedRevision
    ? commitProcessedImage(scope, image, options)
    : scope;
}

export function undoEdit(scope: EditDocumentScope): EditDocumentScope {
  const operation = scope.history.past.at(-1);
  if (!operation) return scope;
  const document = {
    ...scope.document,
    current: operation.before,
    revision: scope.document.revision + 1,
  };
  const next = {
    ...scope,
    document,
    history: withRetainedBytes(
      { ...scope, document },
      {
        past: scope.history.past.slice(0, -1),
        future: [...scope.history.future, operation],
      },
      operation.before,
    ),
  };
  synchronize(next);
  return next;
}

export function redoEdit(scope: EditDocumentScope): EditDocumentScope {
  const operation = scope.history.future.at(-1);
  if (!operation) return scope;
  const document = {
    ...scope.document,
    current: operation.after,
    revision: scope.document.revision + 1,
  };
  const next = {
    ...scope,
    document,
    history: withRetainedBytes(
      { ...scope, document },
      {
        past: [...scope.history.past, operation],
        future: scope.history.future.slice(0, -1),
      },
      operation.after,
    ),
  };
  synchronize(next);
  return next;
}

export function resetEditDocument(scope: EditDocumentScope): EditDocumentScope {
  const document = {
    ...scope.document,
    current: scope.document.baseline,
    revision: scope.document.revision + 1,
  };
  const next = {
    ...scope,
    document,
    history: { past: [], future: [], retainedHistoricalBytes: 0 },
  };
  synchronize(next);
  return next;
}

export interface EditHistorySelectors {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
}

export function selectEditHistory(
  history: EditHistory,
  locale: "en" | "ru",
): EditHistorySelectors {
  const undo = history.past.at(-1);
  const redo = history.future.at(-1);
  return {
    canUndo: Boolean(undo),
    canRedo: Boolean(redo),
    undoLabel: undo
      ? locale === "ru"
        ? `Отменить: ${undo.label}`
        : `Undo: ${undo.label}`
      : null,
    redoLabel: redo
      ? locale === "ru"
        ? `Вернуть: ${redo.label}`
        : `Redo: ${redo.label}`
      : null,
  };
}
