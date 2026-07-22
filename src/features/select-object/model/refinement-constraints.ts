import type { RefinementConstraintMap } from "../../../entities/processed-image";
import { semanticStrokeToPatch } from "./semantic-stroke";
import type { PromptSession, SemanticStroke } from "./types";

function applyStroke(map: RefinementConstraintMap, stroke: SemanticStroke): void {
  const patch = semanticStrokeToPatch(stroke, map.width, map.height);
  if (!patch) return;
  const patchWidth = patch.box.maxX - patch.box.minX + 1;
  for (let y = patch.box.minY; y <= patch.box.maxY; y += 1) {
    for (let x = patch.box.minX; x <= patch.box.maxX; x += 1) {
      const patchIndex = (y - patch.box.minY) * patchWidth + x - patch.box.minX;
      if (patch.coverage[patchIndex]) {
        map.data[y * map.width + x] = patch.mode === "keep" ? 1 : 0;
      }
    }
  }
}

export function createRefinementConstraints(
  session: PromptSession,
): RefinementConstraintMap | null {
  const map: RefinementConstraintMap = {
    width: session.source.width,
    height: session.source.height,
    data: new Int8Array(session.source.width * session.source.height).fill(-1),
  };
  const layers = new Map(session.layers.map((layer) => [layer.id, layer]));
  const applied = new Set<string>();
  for (const entry of session.history) {
    if (entry.type !== "stroke-added") continue;
    applyStroke(map, entry.stroke);
    applied.add(entry.stroke.id);
  }
  for (const layer of layers.values()) {
    for (const stroke of layer.strokes) {
      if (!applied.has(stroke.id)) applyStroke(map, stroke);
    }
  }
  return map.data.some((value) => value !== -1) ? map : null;
}
