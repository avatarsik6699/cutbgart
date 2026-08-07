import type { EditorSessionTypes } from "@/editor/runtime";

export function selectActiveSessionSnapshot(
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
