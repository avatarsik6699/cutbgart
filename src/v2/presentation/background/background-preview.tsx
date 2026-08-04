import { m } from "@/paraglide/messages";
import type { BackgroundFillDescriptor } from "@/v2/domain";
import { Image, Typography } from "@/v2/shared/ui";

import { backgroundFillStyle } from "./background-fill-style";

type Props = {
  fill: BackgroundFillDescriptor;
  foregroundUrl: string;
  height: number;
  imageUrl: string | null;
  width: number;
};

export function BackgroundPreview(props: Props) {
  return (
    <figure className="grid gap-2">
      <div
        className="border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,var(--card)_0_50%)] bg-[length:18px_18px] relative mx-auto w-full max-w-5xl overflow-hidden rounded-lg border"
        style={{ aspectRatio: `${props.width} / ${props.height}` }}
        aria-label={m.editorV2BackgroundPreview()}
      >
        <div
          className="absolute inset-0"
          style={backgroundFillStyle(props.fill, props.imageUrl)}
        />
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
