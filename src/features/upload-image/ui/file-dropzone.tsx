import { Upload } from "lucide-react";
import { useEffect } from "react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";

const ACCEPTED_MIME = "image/jpeg,image/png,image/webp";

export type FileDropzoneProps = {
  className?: string;
  disabled?: boolean;
  multiple?: boolean;
  onFiles: (files: readonly File[]) => void;
};

/** Controller-neutral file admission surface shared by legacy and v2. */
export function FileDropzone(props: FileDropzoneProps) {
  const disabled = props.disabled ?? false;
  const multiple = props.multiple ?? true;
  const onFiles = props.onFiles;
  useEffect(
    function registerPasteUploadFx() {
      if (disabled) return;
      function handlePaste(event: ClipboardEvent) {
        const files = Array.from(event.clipboardData?.items ?? []).flatMap((item) => {
          const file = item.kind === "file" ? item.getAsFile() : null;
          return file === null ? [] : [file];
        });
        if (files.length > 0) onFiles(files);
      }
      window.addEventListener("paste", handlePaste);
      return () => window.removeEventListener("paste", handlePaste);
    },
    [disabled, onFiles],
  );

  return (
    <div
      data-disabled={disabled || undefined}
      className={cn(
        "relative hidden w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-12 text-center transition-colors sm:flex",
        "hover:border-foreground/30 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        props.className,
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (!disabled) props.onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        {m.uploadPrompt()}{" "}
        <span className="font-medium text-foreground">{m.uploadBrowse()}</span>
      </p>
      <p className="font-mono text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wide">
        {multiple ? m.uploadBatchHint() : m.uploadSingleHint()}
      </p>
      <input
        type="file"
        multiple={multiple}
        accept={ACCEPTED_MIME}
        disabled={disabled}
        aria-label={m.uploadAria()}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(event) => {
          props.onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </div>
  );
}
