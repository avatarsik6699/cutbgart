import type { BackgroundFill, HexColor } from "../../../entities/processed-image";

export const TRANSPARENT_FILL: BackgroundFill = { type: "transparent" };
export const DEFAULT_COLOR: HexColor = "#FFFFFF";

export const GRADIENT_PRESETS = [
  {
    name: "Sunset",
    fill: {
      type: "gradient",
      kind: "linear",
      stops: [
        { offset: 0, color: "#FF7A59" },
        { offset: 1, color: "#7B61FF" },
      ],
    },
  },
  {
    name: "Ocean",
    fill: {
      type: "gradient",
      kind: "linear",
      stops: [
        { offset: 0, color: "#00C6FF" },
        { offset: 1, color: "#0072FF" },
      ],
    },
  },
  {
    name: "Mint",
    fill: {
      type: "gradient",
      kind: "linear",
      stops: [
        { offset: 0, color: "#00B09B" },
        { offset: 1, color: "#96C93D" },
      ],
    },
  },
  {
    name: "Spotlight",
    fill: {
      type: "gradient",
      kind: "radial",
      stops: [
        { offset: 0, color: "#FFFFFF" },
        { offset: 1, color: "#DDE7FF" },
      ],
    },
  },
  {
    name: "Peach",
    fill: {
      type: "gradient",
      kind: "radial",
      stops: [
        { offset: 0, color: "#FFF0E5" },
        { offset: 1, color: "#FF8A65" },
      ],
    },
  },
  {
    name: "Night",
    fill: {
      type: "gradient",
      kind: "radial",
      stops: [
        { offset: 0, color: "#334155" },
        { offset: 1, color: "#020617" },
      ],
    },
  },
] as const satisfies readonly { name: string; fill: BackgroundFill }[];

export function normalizeHexColor(value: string): HexColor | null {
  const normalized = value.toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? (normalized as HexColor) : null;
}
