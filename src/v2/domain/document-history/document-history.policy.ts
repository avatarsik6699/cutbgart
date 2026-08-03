import type {
  DocumentHistory,
  DocumentHistoryChange,
  DocumentHistoryEntry,
  DocumentHistoryMove,
} from "./document-history.types";

export const DOCUMENT_HISTORY_ENTRY_LIMIT = 20;
export const DOCUMENT_HISTORY_BYTE_LIMIT = 96 * 1024 * 1024;

export function createEmptyDocumentHistory(): DocumentHistory {
  return { past: [], future: [], retainedHistoricalBytes: 0 };
}

function retainedBytes(entries: readonly DocumentHistoryEntry[]): number {
  return entries.reduce(
    (total, entry) => total + Math.max(0, entry.estimatedHistoricalBytes),
    0,
  );
}

export function commitDocumentHistory(
  history: DocumentHistory,
  entry: DocumentHistoryEntry,
): DocumentHistoryChange {
  const released = [...history.future];
  const past = [...history.past, entry].slice(-DOCUMENT_HISTORY_ENTRY_LIMIT);
  const countPruned = history.past.length + 1 - past.length;
  if (countPruned > 0) released.push(...history.past.slice(0, countPruned));

  while (past.length > 1 && retainedBytes(past) > DOCUMENT_HISTORY_BYTE_LIMIT) {
    const oldest = past.shift();
    if (oldest !== undefined) released.push(oldest);
  }

  return {
    history: { past, future: [], retainedHistoricalBytes: retainedBytes(past) },
    released,
  };
}

export function undoDocumentHistory(history: DocumentHistory): DocumentHistoryMove {
  const entry = history.past.at(-1) ?? null;
  if (entry === null) return { history, entry: null, snapshot: null, released: [] };
  const past = history.past.slice(0, -1);
  const future = [...history.future, entry];
  return {
    history: {
      past,
      future,
      retainedHistoricalBytes: retainedBytes([...past, ...future]),
    },
    entry,
    snapshot: entry.before,
    released: [],
  };
}

export function redoDocumentHistory(history: DocumentHistory): DocumentHistoryMove {
  const entry = history.future.at(-1) ?? null;
  if (entry === null) return { history, entry: null, snapshot: null, released: [] };
  const past = [...history.past, entry];
  const future = history.future.slice(0, -1);
  return {
    history: {
      past,
      future,
      retainedHistoricalBytes: retainedBytes([...past, ...future]),
    },
    entry,
    snapshot: entry.after,
    released: [],
  };
}

export function clearDocumentHistory(history: DocumentHistory): DocumentHistoryChange {
  return {
    history: createEmptyDocumentHistory(),
    released: [...history.past, ...history.future],
  };
}
