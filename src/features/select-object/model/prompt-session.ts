import type { AlphaMatte, SourceImage } from "../../../entities/processed-image";
import type {
  GuidedBox,
  GuidedMaskCandidate,
  GuidedPoint,
  ObjectMaskLayer,
  PromptHistoryEntry,
  PromptSession,
  SemanticStroke,
} from "./types";

export const PROMPT_HISTORY_LIMIT = 50;
let fallbackId = 0;

export function createPromptId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  fallbackId += 1;
  return `${prefix}-${String(fallbackId)}`;
}

function emptyLayer(id: string): ObjectMaskLayer {
  return {
    id,
    points: [],
    targetBox: null,
    strokes: [],
    candidates: [],
    selectedCandidateId: null,
    acceptedMatte: null,
  };
}

export function createPromptSession(
  source: SourceImage,
  baseMatte: AlphaMatte | null = null,
  layerId = createPromptId("layer"),
): PromptSession {
  return {
    source,
    baseMatte,
    layers: [emptyLayer(layerId)],
    activeLayerId: layerId,
    revision: 0,
    history: [],
    redo: [],
  };
}

function activeIndex(session: PromptSession): number {
  return session.layers.findIndex((layer) => layer.id === session.activeLayerId);
}

function replaceLayer(
  session: PromptSession,
  layerId: string,
  update: (layer: ObjectMaskLayer) => ObjectMaskLayer,
): PromptSession {
  return {
    ...session,
    layers: session.layers.map((layer) => (layer.id === layerId ? update(layer) : layer)),
  };
}

function record(session: PromptSession, entry: PromptHistoryEntry): PromptSession {
  return {
    ...session,
    revision: session.revision + 1,
    history: [...session.history, entry].slice(-PROMPT_HISTORY_LIMIT),
    redo: [],
  };
}

function invalidate(layer: ObjectMaskLayer): ObjectMaskLayer {
  return { ...layer, candidates: [], selectedCandidateId: null, acceptedMatte: null };
}

export function appendPoint(session: PromptSession, point: GuidedPoint): PromptSession {
  const layerId = session.activeLayerId;
  return record(
    replaceLayer(session, layerId, (layer) => ({
      ...invalidate(layer),
      points: [...layer.points, point],
    })),
    { type: "point-added", layerId, point },
  );
}

export function setTargetBox(
  session: PromptSession,
  box: GuidedBox | null,
): PromptSession {
  const layerId = session.activeLayerId;
  const before = session.layers[activeIndex(session)]?.targetBox ?? null;
  return record(
    replaceLayer(session, layerId, (layer) => ({ ...invalidate(layer), targetBox: box })),
    { type: "box-changed", layerId, before, after: box },
  );
}

export function appendStroke(
  session: PromptSession,
  stroke: SemanticStroke,
): PromptSession {
  const layerId = session.activeLayerId;
  return record(
    replaceLayer(session, layerId, (layer) => ({
      ...invalidate(layer),
      strokes: [...layer.strokes, stroke],
    })),
    { type: "stroke-added", layerId, stroke },
  );
}

export function addLayer(
  session: PromptSession,
  layerId = createPromptId("layer"),
): PromptSession {
  return record(
    {
      ...session,
      layers: [...session.layers, emptyLayer(layerId)],
      activeLayerId: layerId,
    },
    { type: "layer-added", layerId },
  );
}

export function selectLayer(session: PromptSession, layerId: string): PromptSession {
  if (
    layerId === session.activeLayerId ||
    !session.layers.some((layer) => layer.id === layerId)
  )
    return session;
  return record(
    { ...session, activeLayerId: layerId },
    { type: "layer-selected", beforeId: session.activeLayerId, afterId: layerId },
  );
}

export function removeLayer(session: PromptSession, layerId: string): PromptSession {
  const index = session.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0 || session.layers.length === 1) return session;
  const layer = session.layers[index]!;
  const layers = session.layers.filter((candidate) => candidate.id !== layerId);
  return record(
    {
      ...session,
      layers,
      activeLayerId:
        session.activeLayerId === layerId
          ? layers[Math.min(index, layers.length - 1)]!.id
          : session.activeLayerId,
    },
    {
      type: "layer-removed",
      layerId,
      index,
      promptData: {
        points: layer.points,
        targetBox: layer.targetBox,
        strokes: layer.strokes,
        selectedCandidateId: layer.selectedCandidateId,
      },
    },
  );
}

export function setLayerCandidates(
  session: PromptSession,
  layerId: string,
  candidates: readonly GuidedMaskCandidate[],
): PromptSession {
  return replaceLayer(session, layerId, (layer) => {
    const selected = candidates.find(
      (candidate) => candidate.id === layer.selectedCandidateId,
    );
    const next = selected ?? candidates[0] ?? null;
    return {
      ...layer,
      candidates,
      selectedCandidateId: next?.id ?? null,
      acceptedMatte: next?.matte ?? null,
    };
  });
}

export function selectCandidate(
  session: PromptSession,
  candidateId: string,
): PromptSession {
  const layerId = session.activeLayerId;
  const layer = session.layers[activeIndex(session)];
  const candidate = layer?.candidates.find((item) => item.id === candidateId);
  if (!layer || !candidate || layer.selectedCandidateId === candidateId) return session;
  return record(
    replaceLayer(session, layerId, (current) => ({
      ...current,
      selectedCandidateId: candidateId,
      acceptedMatte: candidate.matte,
    })),
    {
      type: "candidate-selected",
      layerId,
      beforeId: layer.selectedCandidateId,
      afterId: candidateId,
    },
  );
}

export function resetLayer(
  session: PromptSession,
  layerId = session.activeLayerId,
): PromptSession {
  return {
    ...replaceLayer(session, layerId, () => emptyLayer(layerId)),
    revision: session.revision + 1,
    history: [],
    redo: [],
  };
}

function applyEntry(
  session: PromptSession,
  entry: PromptHistoryEntry,
  direction: "undo" | "redo",
): PromptSession {
  const undo = direction === "undo";
  if (entry.type === "point-added")
    return replaceLayer(session, entry.layerId, (layer) => ({
      ...invalidate(layer),
      points: undo
        ? layer.points.filter((point) => point.id !== entry.point.id)
        : [...layer.points, entry.point],
    }));
  if (entry.type === "stroke-added")
    return replaceLayer(session, entry.layerId, (layer) => ({
      ...invalidate(layer),
      strokes: undo
        ? layer.strokes.filter((stroke) => stroke.id !== entry.stroke.id)
        : [...layer.strokes, entry.stroke],
    }));
  if (entry.type === "box-changed")
    return replaceLayer(session, entry.layerId, (layer) => ({
      ...invalidate(layer),
      targetBox: undo ? entry.before : entry.after,
    }));
  if (entry.type === "candidate-selected")
    return replaceLayer(session, entry.layerId, (layer) => {
      const id = undo ? entry.beforeId : entry.afterId;
      return {
        ...layer,
        selectedCandidateId: id,
        acceptedMatte:
          layer.candidates.find((candidate) => candidate.id === id)?.matte ?? null,
      };
    });
  if (entry.type === "layer-selected")
    return { ...session, activeLayerId: undo ? entry.beforeId : entry.afterId };
  if (entry.type === "layer-added") {
    if (undo) {
      const layers = session.layers.filter((layer) => layer.id !== entry.layerId);
      return { ...session, layers, activeLayerId: layers.at(-1)!.id };
    }
    return {
      ...session,
      layers: [...session.layers, emptyLayer(entry.layerId)],
      activeLayerId: entry.layerId,
    };
  }
  if (undo) {
    const restored: ObjectMaskLayer = {
      id: entry.layerId,
      ...entry.promptData,
      candidates: [],
      acceptedMatte: null,
    };
    const layers = [...session.layers];
    layers.splice(entry.index, 0, restored);
    return { ...session, layers, activeLayerId: entry.layerId };
  }
  const layers = session.layers.filter((layer) => layer.id !== entry.layerId);
  return {
    ...session,
    layers,
    activeLayerId: layers[Math.min(entry.index, layers.length - 1)]!.id,
  };
}

export function undoPrompt(session: PromptSession): PromptSession {
  const entry = session.history.at(-1);
  if (!entry) return session;
  const next = applyEntry(session, entry, "undo");
  return {
    ...next,
    revision: session.revision + 1,
    history: session.history.slice(0, -1),
    redo: [...session.redo, entry].slice(-PROMPT_HISTORY_LIMIT),
  };
}

export function redoPrompt(session: PromptSession): PromptSession {
  const entry = session.redo.at(-1);
  if (!entry) return session;
  const next = applyEntry(session, entry, "redo");
  return {
    ...next,
    revision: session.revision + 1,
    history: [...session.history, entry].slice(-PROMPT_HISTORY_LIMIT),
    redo: session.redo.slice(0, -1),
  };
}
