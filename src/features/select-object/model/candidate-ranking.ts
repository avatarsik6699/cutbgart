import type {
  AlphaMatte,
  PixelRect,
  RefinementConstraintMap,
} from "../../../entities/processed-image";
import type { GuidedBrushCandidate, GuidedMaskCandidate } from "./types";

export const MATERIAL_DIFFERENCE_RATIO = 0.001;

function assertDimensions(matte: AlphaMatte, width: number, height: number): void {
  if (
    matte.width !== width ||
    matte.height !== height ||
    matte.data.length !== width * height
  )
    throw new Error("Guided candidate dimensions do not match the constraint map");
}

function forEachRegionPixel(
  region: PixelRect,
  width: number,
  height: number,
  visit: (index: number) => void,
  influenceMask?: Uint8Array,
): void {
  if (influenceMask && influenceMask.length !== width * height)
    throw new Error("Guided influence mask dimensions do not match the candidate");
  const minX = Math.max(0, Math.floor(region.x));
  const minY = Math.max(0, Math.floor(region.y));
  const maxX = Math.min(width, Math.ceil(region.x + region.width));
  const maxY = Math.min(height, Math.ceil(region.y + region.height));
  for (let y = minY; y < maxY; y += 1)
    for (let x = minX; x < maxX; x += 1) {
      const index = y * width + x;
      if (!influenceMask || influenceMask[index]) visit(index);
    }
}

export function localCandidateDifference(
  left: AlphaMatte,
  right: AlphaMatte,
  region: PixelRect,
  influenceMask?: Uint8Array,
): number {
  assertDimensions(right, left.width, left.height);
  let compared = 0;
  let different = 0;
  forEachRegionPixel(
    region,
    left.width,
    left.height,
    (index) => {
      compared += 1;
      if (left.data[index] !== right.data[index]) different += 1;
    },
    influenceMask,
  );
  return compared ? different / compared : 0;
}

function intentAgreement(
  matte: AlphaMatte,
  constraints: RefinementConstraintMap,
): number {
  let marked = 0;
  let agreed = 0;
  constraints.data.forEach((intent, index) => {
    if (intent === -1) return;
    marked += 1;
    const included = (matte.data[index] ?? 0) >= 128;
    if ((intent === 1 && included) || (intent === 0 && !included)) agreed += 1;
  });
  return marked ? agreed / marked : 0;
}

function baseContinuity(
  matte: AlphaMatte,
  baseMatte: AlphaMatte | null,
  region: PixelRect,
  influenceMask?: Uint8Array,
): number {
  if (!baseMatte) return 0;
  assertDimensions(baseMatte, matte.width, matte.height);
  let compared = 0;
  let delta = 0;
  forEachRegionPixel(
    region,
    matte.width,
    matte.height,
    (index) => {
      compared += 1;
      delta += Math.abs((matte.data[index] ?? 0) - (baseMatte.data[index] ?? 0));
    },
    influenceMask,
  );
  return compared ? 1 - delta / (compared * 255) : 0;
}

function foregroundRatio(
  matte: AlphaMatte,
  region: PixelRect,
  influenceMask?: Uint8Array,
): number {
  let compared = 0;
  let foreground = 0;
  forEachRegionPixel(
    region,
    matte.width,
    matte.height,
    (index) => {
      compared += 1;
      if ((matte.data[index] ?? 0) >= 128) foreground += 1;
    },
    influenceMask,
  );
  return compared ? foreground / compared : 0;
}

export function rankGuidedBrushCandidates(
  rawCandidates: readonly GuidedMaskCandidate[],
  constraints: RefinementConstraintMap,
  editRegion: PixelRect,
  baseMatte: AlphaMatte | null,
  influenceMask?: Uint8Array,
): GuidedBrushCandidate[] {
  const ranked = rawCandidates
    .map((candidate, originalIndex) => {
      assertDimensions(candidate.matte, constraints.width, constraints.height);
      return {
        id: candidate.id,
        matte: candidate.matte,
        modelRankScore:
          typeof candidate.score === "number" && Number.isFinite(candidate.score)
            ? candidate.score
            : null,
        intentScore: intentAgreement(candidate.matte, constraints),
        differenceRatio: 0,
        continuity: baseContinuity(candidate.matte, baseMatte, editRegion, influenceMask),
        foregroundRatio: foregroundRatio(candidate.matte, editRegion, influenceMask),
        originalIndex,
      };
    })
    .sort(
      (left, right) =>
        right.intentScore - left.intentScore ||
        right.continuity - left.continuity ||
        (right.modelRankScore ?? -Infinity) - (left.modelRankScore ?? -Infinity) ||
        left.originalIndex - right.originalIndex,
    );
  const reference = ranked[0];
  if (!reference) return [];
  const materiallyDifferent: typeof ranked = [];
  for (const candidate of ranked) {
    if (
      materiallyDifferent.some(
        (kept) =>
          localCandidateDifference(
            kept.matte,
            candidate.matte,
            editRegion,
            influenceMask,
          ) < MATERIAL_DIFFERENCE_RATIO,
      )
    )
      continue;
    materiallyDifferent.push(candidate);
  }
  return materiallyDifferent.slice(0, 3).map((item) => ({
    id: item.id,
    matte: item.matte,
    modelRankScore: item.modelRankScore,
    intentScore: item.intentScore,
    differenceRatio: localCandidateDifference(
      reference.matte,
      item.matte,
      editRegion,
      influenceMask,
    ),
    foregroundRatio: item.foregroundRatio,
  }));
}
