import type { EditorSessionTypes } from "@/editor/runtime";

export function selectActiveActor(
  snapshot: EditorSessionTypes.Snapshot,
): EditorSessionTypes.ActiveSnapshot["actor"] | null {
  return snapshot.kind === "document" ? snapshot.actor : null;
}

function selectActiveSessionSnapshot(
  session: EditorSessionTypes.Session,
): EditorSessionTypes.ActiveSnapshot | null {
  const snapshot = session.getSnapshot();
  return snapshot.kind === "document" ? snapshot : null;
}

export function selectActiveWidth(session: EditorSessionTypes.Session): number {
  return selectActiveSessionSnapshot(session)?.width ?? 0;
}

export function selectActiveHeight(session: EditorSessionTypes.Session): number {
  return selectActiveSessionSnapshot(session)?.height ?? 0;
}

export function selectActiveResultUrl(
  session: EditorSessionTypes.Session,
): string | null {
  return selectActiveSessionSnapshot(session)?.resultUrl ?? null;
}

export function selectActivePreviewUrl(
  session: EditorSessionTypes.Session,
): string | null {
  return selectActiveSessionSnapshot(session)?.previewUrl ?? null;
}

export function selectActiveForegroundUrl(
  session: EditorSessionTypes.Session,
): string | null {
  return selectActiveSessionSnapshot(session)?.foregroundUrl ?? null;
}

export function selectActiveFileName(session: EditorSessionTypes.Session): string | null {
  return selectActiveSessionSnapshot(session)?.fileName ?? null;
}

export function selectActiveBackgroundRuntime(
  session: EditorSessionTypes.Session,
): EditorSessionTypes.ActiveSnapshot["backgroundRuntime"] | null {
  return selectActiveSessionSnapshot(session)?.backgroundRuntime ?? null;
}

export function selectActiveEnhancementRuntime(
  session: EditorSessionTypes.Session,
): EditorSessionTypes.ActiveSnapshot["enhancementRuntime"] | null {
  return selectActiveSessionSnapshot(session)?.enhancementRuntime ?? null;
}

export function selectActiveMagicProgress(
  session: EditorSessionTypes.Session,
): EditorSessionTypes.ActiveSnapshot["magicProgress"] {
  return selectActiveSessionSnapshot(session)?.magicProgress ?? null;
}

export function selectSingleExportSnapshot(
  session: EditorSessionTypes.Session,
): EditorSessionTypes.SingleExportSnapshot {
  return session.singleExportSnapshot();
}

export function selectInferencePath(
  session: EditorSessionTypes.Session,
): EditorSessionTypes.ProcessingSelection["inferencePath"] {
  return session.processingSelection()?.inferencePath ?? "wasm";
}
