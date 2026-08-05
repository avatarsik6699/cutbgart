import type { ChangeEvent } from "react";

import { m } from "@/paraglide/messages";
import { Image, Typography } from "@/v2/shared/ui";

export type EditorV2StageProps = {
  fileName: string | null;
  grid: "fine" | "wide";
  height: number | null;
  onFiles(files: readonly File[]): void;
  previewUrl: string | null;
  resultUrl: string | null;
  status: string;
  width: number | null;
};

function EditorV2Stage(props: EditorV2StageProps) {
  function selectFileFx(event: ChangeEvent<HTMLInputElement>): void {
    const files = [...(event.currentTarget.files ?? [])];
    if (files.length > 0) props.onFiles(files);
    event.currentTarget.value = "";
  }

  const imageUrl = props.resultUrl ?? props.previewUrl;
  const imageAlt =
    props.resultUrl === null ? m.editorV2SourceAlt() : m.editorV2ResultAlt();
  const intrinsicDimensions =
    props.width !== null && props.height !== null
      ? { width: props.width, height: props.height }
      : {};

  return (
    <section
      className={
        props.grid === "fine"
          ? "border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,var(--card)_0_50%)] bg-[length:18px_18px] relative grid min-h-[23rem] place-items-center overflow-hidden rounded-xl border sm:min-h-[32rem]"
          : "border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,var(--card)_0_50%)] bg-[length:40px_40px] relative grid min-h-[23rem] place-items-center overflow-hidden rounded-xl border sm:min-h-[32rem]"
      }
      aria-label={m.editorV2Preview()}
    >
      {imageUrl === null ? (
        <div className="bg-background/92 border-border mx-6 max-w-md rounded-xl border p-7 text-center shadow-lg backdrop-blur-sm sm:p-10">
          <Typography variant="heading-2" as="h2">
            {m.editorV2EmptyTitle()}
          </Typography>
          <Typography variant="body" as="p" className="text-muted-foreground mt-3">
            {m.editorV2EmptyBody()}
          </Typography>
          <label className="bg-primary text-primary-foreground focus-within:ring-ring mt-6 inline-flex cursor-pointer items-center rounded-md px-5 py-2.5 font-mono text-sm font-medium focus-within:ring-2 focus-within:ring-offset-2">
            {m.editorV2ChooseImage()}
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

export { EditorV2Stage };
