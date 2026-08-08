import { Camera } from "lucide-react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";
import { Typography } from "@/shared/ui";

import type { FileAdmissionTypes } from "../file-admission.types";
import { filesFromList } from "../file-admission.utils";

export function ChooseFilesButton(props: FileAdmissionTypes.ChooseButtonProps) {
  const { disabled = false, multiple = true } = props;

  return (
    <label
      data-disabled={disabled || undefined}
      className={cn(
        "flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 sm:hidden",
        "has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        props.className,
      )}
    >
      <Camera className="size-4" aria-hidden="true" />
      <Typography variant="body-small" as="span" className="font-medium">
        {props.label ?? m.choosePhoto()}
      </Typography>
      <input
        type="file"
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          if (event.target.files !== null) {
            props.onFiles(filesFromList(event.target.files, multiple));
          }
          event.target.value = "";
        }}
      />
    </label>
  );
}
