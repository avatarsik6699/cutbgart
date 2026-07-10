import { Camera } from "lucide-react";
import { useCallback } from "react";

import { cn } from "@/shared/lib/utils";
import { validateAndPrepareUpload } from "../model/validate-and-prepare-upload";
import type { UploadResult } from "../model/types";

export interface ChoosePhotoButtonProps {
  disabled?: boolean;
  onUpload: (result: UploadResult) => void;
  className?: string;
}

/**
 * Mobile "choose photo" control with camera capture (`capture` attribute),
 * replacing the drag-and-drop zone on narrow viewports (SPEC.md §5.4).
 */
export function ChoosePhotoButton({
  disabled = false,
  onUpload,
  className,
}: ChoosePhotoButtonProps) {
  const handleFile = useCallback(
    (file: File) => {
      void validateAndPrepareUpload(file).then(onUpload);
    },
    [onUpload],
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
      Choose photo
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          event.target.value = "";
        }}
      />
    </label>
  );
}
