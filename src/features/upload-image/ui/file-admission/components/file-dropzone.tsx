import { ClipboardPaste, Upload } from "lucide-react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";
import { Typography } from "@/shared/ui";

import { usePasteFiles } from "../hooks/use-paste-files";
import type { FileAdmissionTypes } from "../file-admission.types";
import { filesFromList } from "../file-admission.utils";

const ACCEPTED_MIME = "image/jpeg,image/png,image/webp";

export function FileDropzone(props: FileAdmissionTypes.ControlProps) {
  const { disabled = false, multiple = true } = props;
  usePasteFiles({ disabled, multiple, onFiles: props.onFiles });

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
        if (!disabled) props.onFiles(filesFromList(event.dataTransfer.files, multiple));
      }}
    >
      <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
      <Typography variant="body-small" as="p" className="text-muted-foreground">
        {m.uploadPrompt()}{" "}
        <Typography
          variant="body-small"
          as="span"
          className="font-medium text-foreground"
        >
          {m.uploadBrowse()}
        </Typography>
      </Typography>
      <Typography
        variant="caption"
        as="p"
        className="font-mono text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wide"
      >
        {multiple ? m.uploadBatchHint() : m.uploadSingleHint()}
      </Typography>
      <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/45 px-3 py-1.5 text-muted-foreground">
        <ClipboardPaste className="size-3.5" aria-hidden="true" />
        <Typography variant="caption" as="span">
          {m.uploadPasteHint()}
        </Typography>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[0.625rem] text-foreground shadow-xs">
          Ctrl/⌘ + V
        </kbd>
      </div>
      <input
        type="file"
        multiple={multiple}
        accept={ACCEPTED_MIME}
        disabled={disabled}
        aria-label={m.uploadAria()}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(event) => {
          if (event.target.files !== null) {
            props.onFiles(filesFromList(event.target.files, multiple));
          }
          event.target.value = "";
        }}
      />
    </div>
  );
}
