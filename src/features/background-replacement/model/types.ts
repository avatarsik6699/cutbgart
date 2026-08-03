import type { BackgroundFill, HexColor } from "../../../entities/processed-image";
import { BACKGROUND_GRADIENT_PRESETS } from "@/shared/lib/background-gradient-presets";

export const TRANSPARENT_FILL: BackgroundFill = { type: "transparent" };
export const DEFAULT_COLOR: HexColor = "#FFFFFF";

export const GRADIENT_PRESETS = BACKGROUND_GRADIENT_PRESETS.map((preset) => ({
  name: preset.name,
  fill: {
    type: "gradient",
    kind: preset.kind,
    stops: [
      { offset: 0, color: preset.colors[0] },
      { offset: 1, color: preset.colors[1] },
    ],
  },
})) satisfies readonly { name: string; fill: BackgroundFill }[];

export function normalizeHexColor(value: string): HexColor | null {
  const normalized = value.toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? (normalized as HexColor) : null;
}
