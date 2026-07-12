import { Upload } from "lucide-react";
import { useCallback, useEffect } from "react";

import { cn } from "@/shared/lib/utils";
import { validateAndPrepareUpload } from "../model/validate-and-prepare-upload";
import type { UploadResult } from "../model/types";

const ACCEPTED_MIME = "image/jpeg,image/png,image/webp";

export interface UploadDropzoneProps {
  disabled?: boolean;
  onUpload: (result: UploadResult) => void;
  onUploads?: (results: Array<{ fileName: string; result: UploadResult }>) => void;
  onPreparationChange?: (fileCount: number) => void;
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
  onUploads,
  onPreparationChange,
  className,
}: UploadDropzoneProps) {
  const handleFile = useCallback(
    (file: File) => {
      onPreparationChange?.(1);
      void validateAndPrepareUpload(file)
        .then(onUpload)
        .finally(() => onPreparationChange?.(0));
    },
    [onPreparationChange, onUpload],
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      if (files.length === 1 || !onUploads) {
        if (files[0]) handleFile(files[0]);
        return;
      }
      onPreparationChange?.(files.length);
      void Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          result: await validateAndPrepareUpload(file),
        })),
      )
        .then(onUploads)
        .finally(() => onPreparationChange?.(0));
    },
    [handleFile, onPreparationChange, onUploads],
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
        handleFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        Drag and drop an image, paste from clipboard, or{" "}
        <span className="font-medium text-foreground">click to browse</span>
      </p>
      <input
        type="file"
        multiple
        accept={ACCEPTED_MIME}
        disabled={disabled}
        aria-label="Upload an image"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(event) => {
          handleFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </div>
  );
}
