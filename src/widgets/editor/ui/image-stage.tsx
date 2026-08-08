import type { ChangeEvent, CSSProperties } from "react";

import { m } from "@/paraglide/messages";
import { Image, Typography } from "@/shared/ui";

const GRID_CELL_STYLE: Record<ImageStageProps["grid"], CSSProperties> = {
  fine: {},
  wide: { "--transparency-grid-cell": "20px" } as CSSProperties,
};

export type ImageStageProps = {
  fileName: string | null;
  grid: "fine" | "wide";
  height: number | null;
  onFiles(files: readonly File[]): void;
  previewUrl: string | null;
  resultUrl: string | null;
  status: string;
  width: number | null;
};

function ImageStage(props: ImageStageProps) {
  function selectFileFx(event: ChangeEvent<HTMLInputElement>): void {
    const files = [...(event.currentTarget.files ?? [])];
    if (files.length > 0) props.onFiles(files);
    event.currentTarget.value = "";
  }

  const imageUrl = props.resultUrl ?? props.previewUrl;
  const imageAlt = props.resultUrl === null ? m.editorSourceAlt() : m.editorResultAlt();
  const intrinsicDimensions =
    props.width !== null && props.height !== null
      ? { width: props.width, height: props.height }
      : {};

  return (
    <section
      className="border-border transparency-grid relative grid min-h-[23rem] place-items-center overflow-hidden rounded-xl border sm:min-h-[32rem]"
      style={GRID_CELL_STYLE[props.grid]}
      aria-label={m.editorPreview()}
    >
      {imageUrl === null ? (
        <div className="bg-background/92 border-border mx-6 max-w-md rounded-xl border p-7 text-center shadow-lg backdrop-blur-sm sm:p-10">
          <Typography variant="heading-2" as="h2">
            {m.editorEmptyTitle()}
          </Typography>
          <Typography variant="body" as="p" className="text-muted-foreground mt-3">
            {m.editorEmptyBody()}
          </Typography>
          <label className="bg-primary text-primary-foreground focus-within:ring-ring mt-6 inline-flex cursor-pointer items-center rounded-md px-5 py-2.5 font-mono text-sm font-medium focus-within:ring-2 focus-within:ring-offset-2">
            {m.editorChooseImage()}
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={selectFileFx}
            />
          </label>
        </div>
      ) : (
        <div className="absolute inset-0 grid place-items-center p-5 sm:p-8">
          <Image
            src={imageUrl}
            alt={imageAlt}
            preset="preview"
            {...intrinsicDimensions}
            className="max-h-full max-w-full shadow-2xl"
          />
        </div>
      )}
      {props.status !== "empty" &&
      props.status !== "result" &&
      props.status !== "error" ? (
        <div className="bg-background/90 border-border absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-lg border px-3 py-2 backdrop-blur sm:inset-x-auto sm:right-4 sm:bottom-4 sm:left-4">
          <span className="bg-primary motion-safe:animate-pulse block size-2 rounded-full" />
          <Typography variant="caption" as="span" className="truncate font-mono">
            {props.fileName}
          </Typography>
        </div>
      ) : null}
    </section>
  );
}

export { ImageStage };
