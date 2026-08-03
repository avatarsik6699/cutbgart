import type { CSSProperties } from "react";

import { m } from "@/paraglide/messages";
import type { BackgroundFillDescriptor } from "@/v2/domain";
import { Image, Typography } from "@/v2/shared/ui";

type Props = {
  fill: BackgroundFillDescriptor;
  foregroundUrl: string;
  height: number;
  imageUrl: string | null;
  width: number;
};

function fillStyle(
  fill: BackgroundFillDescriptor,
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

export function BackgroundPreview(props: Props) {
  return (
    <figure className="grid gap-2">
      <div
        className="border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,var(--card)_0_50%)] bg-[length:18px_18px] relative mx-auto w-full max-w-5xl overflow-hidden rounded-lg border"
        style={{ aspectRatio: `${props.width} / ${props.height}` }}
        aria-label={m.editorV2BackgroundPreview()}
      >
        <div className="absolute inset-0" style={fillStyle(props.fill, props.imageUrl)} />
        <Image
          src={props.foregroundUrl}
          alt={m.editorV2BackgroundSubjectAlt()}
          preset="preview"
          width={props.width}
          height={props.height}
          className="absolute inset-0 size-full object-contain"
        />
      </div>
      <figcaption>
        <Typography variant="caption" as="span" className="text-muted-foreground">
          {m.editorV2BackgroundExportNotice()}
        </Typography>
      </figcaption>
    </figure>
  );
}
