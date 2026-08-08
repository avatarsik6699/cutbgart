import { Upload } from "lucide-react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";
import { Typography } from "@/shared/ui";

import type { FileAdmissionTypes } from "../file-admission.types";
import { filesFromList } from "../file-admission.utils";

const ACCEPTED_MIME = "image/jpeg,image/png,image/webp";

export function FileDropzone(props: FileAdmissionTypes.ControlProps) {
  const { disabled = false, multiple = true } = props;

  return (
    <div
      data-disabled={disabled || undefined}
      className={cn(
        "relative hidden w-full flex-col items-center justify-center gap-3 text-center sm:flex",
        "data-disabled:pointer-events-none",
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
