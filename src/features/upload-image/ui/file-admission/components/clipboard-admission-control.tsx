import { ClipboardPaste } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Button, Typography } from "@/shared/ui";

import type { FileAdmissionTypes } from "../file-admission.types";

export function ClipboardAdmissionControl(
  props: Readonly<{
    disabled: boolean;
    feedback: FileAdmissionTypes.ClipboardFeedback;
    onReadClipboard: () => void;
  }>,
) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Button
        type="button"
        variant="outline"
        disabled={props.disabled || props.feedback.kind === "reading"}
        onClick={props.onReadClipboard}
        className="w-full gap-2 sm:w-auto"
      >
        <ClipboardPaste className="size-4" aria-hidden="true" />
        {m.uploadPasteHint()}
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[0.625rem] text-foreground shadow-xs">
          Ctrl/⌘ + V
        </kbd>
      </Button>
      {props.feedback.kind !== "idle" ? (
        <Typography
          variant="caption"
          as="p"
          role={props.feedback.kind === "error" ? "alert" : "status"}
          data-clipboard-feedback={props.feedback.kind}
          className={
            props.feedback.kind === "error"
              ? "max-w-md text-destructive"
              : "max-w-md text-muted-foreground"
          }
        >
          {props.feedback.message}
        </Typography>
      ) : null}
    </div>
  );
}
