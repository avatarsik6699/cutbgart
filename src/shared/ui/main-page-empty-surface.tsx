import type { ReactNode } from "react";

export type MainPageEmptySurfaceProps = Readonly<{
  errorSlot?: ReactNode;
  preparationSlot?: ReactNode;
  qualitySlot: ReactNode;
  uploadButtonSlot: ReactNode;
  uploadDropzoneSlot: ReactNode;
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
      {props.qualitySlot}
      {props.uploadDropzoneSlot}
      {props.uploadButtonSlot}
      {props.preparationSlot}
      {props.errorSlot}
    </section>
  );
}
