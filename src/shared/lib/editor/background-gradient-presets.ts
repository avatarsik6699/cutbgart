export const BACKGROUND_GRADIENT_PRESETS = Object.freeze([
  Object.freeze({
    id: "sunset",
    name: "Sunset",
    kind: "linear",
    colors: ["#FF7A59", "#7B61FF"] as const,
  }),
  Object.freeze({
    id: "ocean",
    name: "Ocean",
    kind: "linear",
    colors: ["#00C6FF", "#0072FF"] as const,
  }),
  Object.freeze({
    id: "mint",
    name: "Mint",
    kind: "linear",
    colors: ["#00B09B", "#96C93D"] as const,
  }),
  Object.freeze({
    id: "spotlight",
    name: "Spotlight",
    kind: "radial",
    colors: ["#FFFFFF", "#DDE7FF"] as const,
  }),
  Object.freeze({
    id: "peach",
    name: "Peach",
    kind: "radial",
    colors: ["#FFF0E5", "#FF8A65"] as const,
  }),
  Object.freeze({
    id: "night",
    name: "Night",
    kind: "radial",
    colors: ["#334155", "#020617"] as const,
  }),
] as const);
