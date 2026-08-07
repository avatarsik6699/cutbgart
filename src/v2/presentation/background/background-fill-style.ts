import type { CSSProperties } from "react";

import type { BackgroundTypes } from "@/v2/domain";

export function backgroundFillStyle(
  fill: BackgroundTypes.FillDescriptor,
  imageUrl: string | null,
): CSSProperties {
  if (fill.type === "transparent") return {};
  if (fill.type === "color") return { backgroundColor: fill.value };
  if (fill.type === "image") {
    return imageUrl === null
      ? {}
      : {
          backgroundImage: `url("${imageUrl.replaceAll('"', '\\"')}")`,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        };
  }
  const start = fill.stops[0].color;
  const end = fill.stops[1].color;
  return {
    backgroundImage:
      fill.kind === "linear"
        ? `linear-gradient(135deg, ${start}, ${end})`
        : `radial-gradient(circle at 50% 42%, ${start}, ${end})`,
  };
}
