import type { AlphaMatte, SourceImage } from "../../../entities/processed-image";
import type {
  GuidedBrushCandidate,
  GuidedBrushSession,
  GuidedBrushStatus,
  GuidedBrushStroke,
  GuidedBrushViewSession,
} from "./types";

export const GUIDED_BRUSH_HISTORY_LIMIT = 50;
export const GUIDED_BRUSH_STROKE_LIMIT = GUIDED_BRUSH_HISTORY_LIMIT;
export const GUIDED_BRUSH_POINT_LIMIT = 512;
export const DEFAULT_GUIDED_BRUSH_RADIUS = 16;

let fallbackId = 0;

export function createGuidedBrushId(prefix = "brush-stroke"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  fallbackId += 1;
  return `${prefix}-${String(fallbackId)}`;
}

export function createGuidedBrushSession(
  source: SourceImage,
  baseMatte: AlphaMatte | null = null,
  brushRadius = DEFAULT_GUIDED_BRUSH_RADIUS,
): GuidedBrushSession {
  return {
    source,
    baseMatte,
    strokes: [],
    brushRadius: Math.max(1, Math.round(brushRadius)),
    status: "loading-model",
    revision: 0,
    computedRevision: null,
    editRegion: null,
    candidates: [],
    selectedCandidateId: null,
    history: [],
    redo: [],
  };
}

export function createGuidedBrushViewSession(
  session: GuidedBrushSession,
): GuidedBrushViewSession {
  return {
    source: session.source,
    hasBaseMatte: session.baseMatte !== null,
    strokes: session.strokes,
    brushRadius: session.brushRadius,
    status: session.status,
    revision: session.revision,
    computedRevision: session.computedRevision,
    editRegion: session.editRegion,
    candidates: session.candidates.map((candidate) => ({
      id: candidate.id,
      modelRankScore: candidate.modelRankScore,
      intentScore: candidate.intentScore,
      differenceRatio: candidate.differenceRatio,
      foregroundRatio: candidate.foregroundRatio,
    })),
    selectedCandidateId: session.selectedCandidateId,
    history: session.history,
    redo: session.redo,
  };
}

function dirty(session: GuidedBrushSession): GuidedBrushSession {
  return {
    ...session,
    status: "dirty",
    revision: session.revision + 1,
  };
}

export function setGuidedBrushStatus(
  session: GuidedBrushSession,
  status: GuidedBrushStatus,
): GuidedBrushSession {
  return { ...session, status };
}

export function setGuidedBrushRadius(
  session: GuidedBrushSession,
  radius: number,
): GuidedBrushSession {
  const brushRadius = Math.max(1, Math.round(radius));
  return brushRadius === session.brushRadius ? session : { ...session, brushRadius };
}

export function appendGuidedBrushStroke(
  session: GuidedBrushSession,
  stroke: GuidedBrushStroke,
): GuidedBrushSession {
  if (!stroke.points.length || session.strokes.length >= GUIDED_BRUSH_STROKE_LIMIT)
    return session;
  const boundedStroke = {
    ...stroke,
    points: stroke.points.slice(0, GUIDED_BRUSH_POINT_LIMIT),
  };
  return dirty({
    ...session,
    strokes: [...session.strokes, boundedStroke],
    history: [...session.history, boundedStroke].slice(-GUIDED_BRUSH_HISTORY_LIMIT),
    redo: [],
  });
}

export function undoGuidedBrushStroke(session: GuidedBrushSession): GuidedBrushSession {
  const stroke = session.history.at(-1);
  if (!stroke) return session;
  return dirty({
    ...session,
    strokes: session.strokes.filter((candidate) => candidate.id !== stroke.id),
    history: session.history.slice(0, -1),
    redo: [...session.redo, stroke].slice(-GUIDED_BRUSH_HISTORY_LIMIT),
  });
}

export function redoGuidedBrushStroke(session: GuidedBrushSession): GuidedBrushSession {
  const stroke = session.redo.at(-1);
  if (!stroke) return session;
  return dirty({
    ...session,
    strokes: [...session.strokes, stroke],
    history: [...session.history, stroke].slice(-GUIDED_BRUSH_HISTORY_LIMIT),
    redo: session.redo.slice(0, -1),
  });
}

export function clearGuidedBrushStrokes(session: GuidedBrushSession): GuidedBrushSession {
  if (!session.strokes.length) return session;
  return dirty({
    ...session,
    strokes: [],
    history: [],
    redo: [],
  });
}

export function setGuidedBrushCandidates(
  session: GuidedBrushSession,
  candidates: readonly GuidedBrushCandidate[],
  editRegion: GuidedBrushSession["editRegion"],
): GuidedBrushSession {
  const selected = candidates.find(
    (candidate) => candidate.id === session.selectedCandidateId,
  );
  return {
    ...session,
    status: "preview",
    computedRevision: session.revision,
    editRegion,
    candidates,
    selectedCandidateId: (selected ?? candidates[0] ?? null)?.id ?? null,
  };
}

export function selectGuidedBrushCandidate(
  session: GuidedBrushSession,
  candidateId: string,
): GuidedBrushSession {
  if (
    session.computedRevision !== session.revision ||
    !session.candidates.some((candidate) => candidate.id === candidateId)
  )
    return session;
  return { ...session, selectedCandidateId: candidateId, status: "preview" };
}

/**
 * Starts a new, empty marking pass from an explicitly chosen computed result.
 * The fused result becomes the next pass' visible base, so clearing the old
 * strokes does not discard their effect or turn them into hidden constraints.
 */
export function continueGuidedBrushFromResult(
  session: GuidedBrushSession,
  matte: AlphaMatte,
): GuidedBrushSession {
  if (
    session.status !== "preview" ||
    session.computedRevision !== session.revision ||
    session.selectedCandidateId === null ||
    matte.width !== session.source.width ||
    matte.height !== session.source.height
  )
    return session;
  const revision = session.revision + 1;
  return {
    ...session,
    baseMatte: matte,
    strokes: [],
    status: "preview",
    revision,
    computedRevision: revision,
    editRegion: null,
    candidates: [],
    selectedCandidateId: null,
    history: [],
    redo: [],
  };
}

export function canAcceptGuidedBrushSession(session: GuidedBrushSession): boolean {
  return (
    session.status === "preview" &&
    session.computedRevision === session.revision &&
    (session.selectedCandidateId !== null ||
      (session.baseMatte !== null && session.strokes.length === 0))
  );
}
