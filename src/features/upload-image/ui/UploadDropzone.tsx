import { Upload } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";
import { validateAndPrepareUpload } from "../model/validate-and-prepare-upload";
import type { UploadResult } from "../model/types";

const ACCEPTED_MIME = "image/jpeg,image/png,image/webp";

export interface UploadDropzoneProps {
  disabled?: boolean;
  onUpload: (result: UploadResult) => void;
  onUploads?: (results: Array<{ fileName: string; result: UploadResult }>) => void;
  onPreparationChange?: (fileCount: number) => void;
  batchMode?: boolean;
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
  batchMode = false,
  className,
}: UploadDropzoneProps) {
  // Guards the preparation counter against overlapping triggers (e.g. a
  // paste while a drop is still validating): only the most recent call's
  // `.finally` may zero the shared counter, so a newer in-flight upload's
  // count is never wiped out from under it (PHASE_31 T8, mirrors
  // `use-background-fill.ts`'s revision pattern).
  const revisionRef = useRef(0);

  const handleFile = useCallback(
    (file: File) => {
      revisionRef.current += 1;
      const revision = revisionRef.current;
      onPreparationChange?.(1);
      void validateAndPrepareUpload(file)
        .then(onUpload)
        .finally(() => {
          if (revisionRef.current === revision) onPreparationChange?.(0);
        });
    },
    [onPreparationChange, onUpload],
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      if ((files.length === 1 && !batchMode) || !onUploads) {
        if (files[0]) handleFile(files[0]);
        return;
      }
      revisionRef.current += 1;
      const revision = revisionRef.current;
      onPreparationChange?.(files.length);
      void Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          result: await validateAndPrepareUpload(file),
        })),
      )
        .then(onUploads)
        .finally(() => {
          if (revisionRef.current === revision) onPreparationChange?.(0);
        });
    },
    [batchMode, handleFile, onPreparationChange, onUploads],
  );

  useEffect(() => {
    if (disabled) return;
    function handlePaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === "file")
        ?.getAsFile();
      if (file) handleFiles([file]);
    }
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [disabled, handleFiles]);

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
        {m.uploadPrompt()}{" "}
        <span className="font-medium text-foreground">{m.uploadBrowse()}</span>
      </p>
      <p className="font-mono text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wide">
        {m.uploadBatchHint()}
      </p>
      <input
        type="file"
        multiple
        accept={ACCEPTED_MIME}
        disabled={disabled}
        aria-label={m.uploadAria()}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(event) => {
          handleFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </div>
  );
}
