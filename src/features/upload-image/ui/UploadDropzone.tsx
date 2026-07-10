import { Upload } from "lucide-react";
import { useCallback, useEffect } from "react";

import { cn } from "@/shared/lib/utils";
import { validateAndPrepareUpload } from "../model/validate-and-prepare-upload";
import type { UploadResult } from "../model/types";

const ACCEPTED_MIME = "image/jpeg,image/png,image/webp";

export interface UploadDropzoneProps {
  disabled?: boolean;
  onUpload: (result: UploadResult) => void;
  className?: string;
}

/**
 * Full-area drag-and-drop / click-to-browse / clipboard-paste upload zone
 * (SPEC.md §1.3, §5.2). The real `<input type="file">` covers the whole zone
 * so it stays keyboard-accessible (Tab + Enter/Space opens the file dialog)
 * rather than being a visual-only drop target (SPEC.md §5.4). Hidden on
 * narrow viewports in favor of `ChoosePhotoButton`.
 */
export function UploadDropzone({
  disabled = false,
  onUpload,
  className,
}: UploadDropzoneProps) {
  const handleFile = useCallback(
    (file: File) => {
      void validateAndPrepareUpload(file).then(onUpload);
    },
    [onUpload],
  );

  useEffect(() => {
    if (disabled) return;
    function handlePaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === "file")
        ?.getAsFile();
      if (file) handleFile(file);
    }
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [disabled, handleFile]);

  return (
    <div
      data-disabled={disabled || undefined}
      className={cn(
        "relative hidden w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-12 text-center transition-colors sm:flex",
        "hover:border-foreground/30 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (disabled) return;
        const file = event.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
    >
      <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        Drag and drop an image, paste from clipboard, or{" "}
        <span className="font-medium text-foreground">click to browse</span>
      </p>
      <input
        type="file"
        accept={ACCEPTED_MIME}
        disabled={disabled}
        aria-label="Upload an image"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
