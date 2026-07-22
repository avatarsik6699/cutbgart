import type {
  AlphaMatte,
  RefinementConstraintMap,
  Trimap,
} from "../../../entities/processed-image";

export function deterministicRefinement({
  priorMatte,
  guidedMatte = null,
  trimap,
  constraints = null,
}: {
  priorMatte: AlphaMatte;
  guidedMatte?: AlphaMatte | null;
  trimap: Trimap;
  constraints?: RefinementConstraintMap | null;
}): AlphaMatte {
  if (
    priorMatte.width !== trimap.width ||
    priorMatte.height !== trimap.height ||
    (guidedMatte &&
      (guidedMatte.width !== priorMatte.width ||
        guidedMatte.height !== priorMatte.height))
  ) {
    throw new Error("Deterministic refinement dimensions must match");
  }
  const data = priorMatte.data.slice();
  for (let index = 0; index < data.length; index += 1) {
    if (trimap.data[index] === 0) data[index] = 0;
    else if (trimap.data[index] === 255) data[index] = 255;
    else if (guidedMatte) data[index] = guidedMatte.data[index] ?? data[index] ?? 0;
    const constraint = constraints?.data[index] ?? -1;
    if (constraint === 0) data[index] = 0;
    else if (constraint === 1) data[index] = 255;
  }
  return { width: priorMatte.width, height: priorMatte.height, data };
}
