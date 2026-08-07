import type { BackgroundTypes } from "./background.types";
import type { ArtifactId } from "../ids";

export const TRANSPARENT_BACKGROUND = {
  type: "transparent",
} as const satisfies BackgroundTypes.FillDescriptor;

export function normalizeHexColor(value: string): BackgroundTypes.HexColor | null {
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized)
    ? (normalized as BackgroundTypes.HexColor)
    : null;
}

export function normalizeBackgroundFill(
  value: unknown,
): BackgroundTypes.FillDescriptor | null {
  if (typeof value !== "object" || value === null || !("type" in value)) return null;
  const fill = value as Record<string, unknown>;
  if (fill.type === "transparent") return TRANSPARENT_BACKGROUND;
  if (fill.type === "color" && typeof fill.value === "string") {
    const color = normalizeHexColor(fill.value);
    return color === null ? null : { type: "color", value: color };
  }
  if (
    fill.type === "image" &&
    typeof fill.artifactId === "string" &&
    fill.artifactId.length > 0
  ) {
    return { type: "image", artifactId: fill.artifactId as ArtifactId };
  }
  if (
    fill.type !== "gradient" ||
    (fill.kind !== "linear" && fill.kind !== "radial") ||
    !Array.isArray(fill.stops) ||
    fill.stops.length !== 2
  ) {
    return null;
  }
  const [first, second] = fill.stops as unknown[];
  if (
    typeof first !== "object" ||
    first === null ||
    typeof second !== "object" ||
    second === null
  ) {
    return null;
  }
  const start = first as Record<string, unknown>;
  const end = second as Record<string, unknown>;
  if (
    start.offset !== 0 ||
    end.offset !== 1 ||
    typeof start.color !== "string" ||
    typeof end.color !== "string"
  ) {
    return null;
  }
  const startColor = normalizeHexColor(start.color);
  const endColor = normalizeHexColor(end.color);
  return startColor === null || endColor === null
    ? null
    : {
        type: "gradient",
        kind: fill.kind,
        stops: [
          { offset: 0, color: startColor },
          { offset: 1, color: endColor },
        ],
      };
}

export function sameBackgroundFill(
  left: BackgroundTypes.FillDescriptor,
  right: BackgroundTypes.FillDescriptor,
): boolean {
  if (left.type !== right.type) return false;
  switch (left.type) {
    case "transparent":
      return true;
    case "color":
      return right.type === "color" && left.value === right.value;
    case "image":
      return right.type === "image" && left.artifactId === right.artifactId;
    case "gradient":
      return (
        right.type === "gradient" &&
        left.kind === right.kind &&
        left.stops[0].color === right.stops[0].color &&
        left.stops[1].color === right.stops[1].color
      );
  }
}

export function changeBackgroundDraft(
  draft: BackgroundTypes.Draft,
  fill: BackgroundTypes.FillDescriptor,
): BackgroundTypes.Draft {
  return {
    ...draft,
    draftRevision: draft.draftRevision + 1,
    fill,
    dirty: true,
    status: "ready",
  };
}
