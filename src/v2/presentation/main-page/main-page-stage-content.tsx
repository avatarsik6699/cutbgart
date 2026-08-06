import { BeforeAfterUrlSlider } from "@/entities/processed-image";
import { m } from "@/paraglide/messages";
import { Image, Typography } from "@/shared/ui";

import type { MainPageEditorProjection } from "./main-page-editor-contract";

type Props = Readonly<{
  projection: MainPageEditorProjection;
  loadingText: string;
}>;

type ComparisonImage = Readonly<{ alt: string; decorative: boolean; src: string }>;

function renderComparisonImage(image: ComparisonImage) {
  return image.decorative ? (
    <Image
      src={image.src}
      decorative
      preset="preview"
      className="h-full w-full object-contain"
    />
  ) : (
    <Image
      src={image.src}
      alt={image.alt}
      preset="preview"
      className="h-full w-full object-contain"
    />
  );
}

export function MainPageStageContent(props: Props) {
  const projection = props.projection;
  if (
    projection.phase === "preparing" ||
    projection.phase === "loading-model" ||
    projection.phase === "processing"
  ) {
    return (
      <Typography
        variant="body-small"
        as="p"
        className="rounded-full border border-border bg-background/90 px-4 py-2 font-mono font-medium leading-5 text-foreground"
      >
        {projection.phase === "loading-model"
          ? props.loadingText
          : m.removingBackground()}
      </Typography>
    );
  }
  if (
    projection.phase === "result" &&
    projection.committedResultUrl !== null &&
    projection.sourcePreviewUrl !== null &&
    projection.width !== null &&
    projection.height !== null
  ) {
    return (
      <BeforeAfterUrlSlider
        afterUrl={projection.committedResultUrl}
        beforeUrl={projection.sourcePreviewUrl}
        height={projection.height}
        renderImage={renderComparisonImage}
        width={projection.width}
      />
    );
  }
  if (projection.sourcePreviewUrl !== null) {
    return (
      <Image
        src={projection.sourcePreviewUrl}
        alt={m.editorV2SourceAlt()}
        preset="preview"
        className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
      />
    );
  }
  return null;
}
