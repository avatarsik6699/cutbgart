import { Camera } from "lucide-react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";

export type ChooseFilesButtonProps = {
  className?: string;
  disabled?: boolean;
  label?: string;
  multiple?: boolean;
  onFiles: (files: readonly File[]) => void;
};

/** Controller-neutral narrow-viewport picker shared by legacy and v2. */
export function ChooseFilesButton(props: ChooseFilesButtonProps) {
  const disabled = props.disabled ?? false;
  const multiple = props.multiple ?? true;
  return (
    <label
      data-disabled={disabled || undefined}
      className={cn(
        "flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium sm:hidden",
        "has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        props.className,
      )}
    >
      <Camera className="size-4" aria-hidden="true" />
      {props.label ?? m.choosePhoto()}
      <input
        type="file"
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          props.onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </label>
  );
}
