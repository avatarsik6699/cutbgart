import { BeforeAfterUrlSlider } from "@/entities/processed-image";
import { m } from "@/paraglide/messages";
import { EditorStage, Image, Typography } from "@/shared/ui";

import type { MainPageEditorTypes } from "../../main-page-editor.types";

type Props = Readonly<{
  committedResultUrl: string | null;
  EmptyState?: ReactNode;
  height: number | null;
  loadingText: string;
  phase: MainPageEditorTypes.Phase;
  sourcePreviewUrl: string | null;
  width: number | null;
}>;

type ComparisonImage = Readonly<{ alt: string; decorative: boolean; src: string }>;

function renderComparisonImage(image: ComparisonImage) {
  if (image.decorative) {
    return (
      <Image
        src={image.src}
        decorative
        preset="preview"
        className="h-full w-full object-contain"
      />
    );
  }
  return (
    <Image
      src={image.src}
      alt={image.alt}
      preset="preview"
      className="h-full w-full object-contain"
    />
  );
}

export function SingleImageStage(props: Props) {
  const loading =
    props.phase === "preparing" ||
    props.phase === "loading-model" ||
    props.phase === "processing";

  let content = null;
  if (loading) {
    content = (
      <Typography
        variant="body-small"
        as="p"
        className="rounded-full border border-border bg-background/90 px-4 py-2 font-mono font-medium leading-5 text-foreground"
      >
        {props.phase === "loading-model" ? props.loadingText : m.removingBackground()}
      </Typography>
    );
  } else if (
    props.phase === "result" &&
    props.committedResultUrl !== null &&
    props.sourcePreviewUrl !== null &&
    props.width !== null &&
    props.height !== null
  ) {
    content = (
      <BeforeAfterUrlSlider
        afterUrl={props.committedResultUrl}
        beforeUrl={props.sourcePreviewUrl}
        height={props.height}
        renderImage={renderComparisonImage}
        width={props.width}
      />
    );
  } else if (props.sourcePreviewUrl !== null) {
    content = (
      <Image
        src={props.sourcePreviewUrl}
        alt={m.editorSourceAlt()}
        preset="preview"
        className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
      />
    );
  } else if (props.EmptyState !== undefined) {
    content = props.EmptyState;
  }

  return (
    <div className="[grid-area:surface]">
      <EditorStage documentId="main-page-editor" loading={loading}>
        {content}
      </EditorStage>
    </div>
  );
}
import type { ReactNode } from "react";
