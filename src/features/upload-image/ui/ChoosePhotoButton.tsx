import { Camera } from "lucide-react";
import { useCallback, useRef } from "react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";
import { useUploadPreparation } from "../model/use-upload-preparation";
import type { UploadResult } from "../model/types";

export type ChoosePhotoButtonProps = {
  disabled?: boolean;
  onUpload: (result: UploadResult) => void;
  onUploads?: (results: Array<{ fileName: string; result: UploadResult }>) => void;
  onPreparationChange?: (fileCount: number) => void;
  batchMode?: boolean;
  label?: string;
  className?: string;
};

/**
 * Mobile "choose photo" control with camera capture (`capture` attribute),
 * replacing the drag-and-drop zone on narrow viewports (SPEC.md §5.4).
 */
export function ChoosePhotoButton(props: ChoosePhotoButtonProps) {
  // Guards the preparation counter against overlapping triggers: only the
  // most recent call's `.finally` may zero the shared counter (PHASE_31 T8,
  // mirrors `use-background-fill.ts`'s revision pattern).
  const revisionRef = useRef(0);
  const preparation = useUploadPreparation();
  const disabled = props.disabled ?? false;
  const batchMode = props.batchMode ?? false;

  const handleFile = useCallback(
    (file: File) => {
      revisionRef.current += 1;
      const revision = revisionRef.current;
      props.onPreparationChange?.(1);
      void preparation
        .prepareFile(file)
        .then((result) => {
          if (revisionRef.current === revision) props.onUpload(result);
        })
        .finally(() => {
          if (revisionRef.current === revision) props.onPreparationChange?.(0);
        });
    },
    [preparation, props],
  );

  return (
    <label
      data-disabled={disabled || undefined}
      className={cn(
        "flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium sm:hidden",
        "has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        props.className,
      )}
    >
      <Camera className="size-4" aria-hidden="true" />
      {props.label ?? m.choosePhoto()}
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if ((files.length > 1 || batchMode) && props.onUploads) {
            revisionRef.current += 1;
            const revision = revisionRef.current;
            props.onPreparationChange?.(files.length);
            void preparation
              .prepareFiles(files)
              .then((results) => {
                if (revisionRef.current === revision) props.onUploads?.(results);
              })
              .finally(() => {
                if (revisionRef.current === revision) props.onPreparationChange?.(0);
              });
          } else if (files[0]) {
            handleFile(files[0]);
          }
          event.target.value = "";
        }}
      />
    </label>
  );
}
