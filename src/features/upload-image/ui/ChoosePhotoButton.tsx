import { Camera } from "lucide-react";
import { useCallback } from "react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";
import { validateAndPrepareUpload } from "../model/validate-and-prepare-upload";
import type { UploadResult } from "../model/types";

export interface ChoosePhotoButtonProps {
  disabled?: boolean;
  onUpload: (result: UploadResult) => void;
  onUploads?: (results: Array<{ fileName: string; result: UploadResult }>) => void;
  onPreparationChange?: (fileCount: number) => void;
  batchMode?: boolean;
  label?: string;
  className?: string;
}

/**
 * Mobile "choose photo" control with camera capture (`capture` attribute),
 * replacing the drag-and-drop zone on narrow viewports (SPEC.md §5.4).
 */
export function ChoosePhotoButton({
  disabled = false,
  onUpload,
  onUploads,
  onPreparationChange,
  batchMode = false,
  label,
  className,
}: ChoosePhotoButtonProps) {
  const handleFile = useCallback(
    (file: File) => {
      onPreparationChange?.(1);
      void validateAndPrepareUpload(file)
        .then(onUpload)
        .finally(() => onPreparationChange?.(0));
    },
    [onPreparationChange, onUpload],
  );

  return (
    <label
      data-disabled={disabled || undefined}
      className={cn(
        "flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium sm:hidden",
        "has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
    >
      <Camera className="size-4" aria-hidden="true" />
      {label ?? m.choosePhoto()}
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if ((files.length > 1 || batchMode) && onUploads) {
            onPreparationChange?.(files.length);
            void Promise.all(
              files.map(async (file) => ({
                fileName: file.name,
                result: await validateAndPrepareUpload(file),
              })),
            )
              .then(onUploads)
              .finally(() => onPreparationChange?.(0));
          } else if (files[0]) {
            handleFile(files[0]);
          }
          event.target.value = "";
        }}
      />
    </label>
  );
}
