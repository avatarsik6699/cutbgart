import type { ReactNode } from "react";

export type MainPageEmptySurfaceProps = Readonly<{
  ErrorSlot?: ReactNode;
  PreparationSlot?: ReactNode;
  QualitySlot: ReactNode;
  UploadButtonSlot: ReactNode;
  UploadDropzoneSlot: ReactNode;
}>;

/** Shared visual composition; admission and workflow ownership stay in adapters. */
export function MainPageEmptySurface(props: MainPageEmptySurfaceProps) {
  return (
    <section className="command-deck relative isolate flex min-h-[30rem] flex-col justify-center gap-5 px-1 py-5 sm:px-3 sm:py-7">
      <span
        aria-hidden="true"
        className="command-deck-ambient command-deck-ambient-primary"
      />
      <span
        aria-hidden="true"
        className="command-deck-ambient command-deck-ambient-secondary"
      />
      {props.QualitySlot}
      {props.UploadDropzoneSlot}
      {props.UploadButtonSlot}
      {props.PreparationSlot}
      {props.ErrorSlot}
    </section>
  );
}
