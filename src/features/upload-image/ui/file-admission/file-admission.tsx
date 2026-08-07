import { cn } from "@/shared/lib/utils";

import { ClipboardAdmissionControl } from "./components/clipboard-admission-control";
import { ChooseFilesButton } from "./components/choose-files-button";
import { FileDropzone } from "./components/file-dropzone";
import { FileAdmissionStatus } from "./components/file-admission-status";
import type { FileAdmissionTypes } from "./file-admission.types";
import { useClipboardAdmission } from "./hooks/use-clipboard-admission";

const IDLE_STATE: FileAdmissionTypes.State = { kind: "idle" };

export function FileAdmission(props: FileAdmissionTypes.Props) {
  const { state = IDLE_STATE } = props;
  const clipboard = useClipboardAdmission({
    disabled: props.disabled || state.kind !== "idle",
    multiple: props.multiple,
    onFiles: props.onFiles,
  });

  if (state.kind !== "idle") {
    return <FileAdmissionStatus className={props.dropzoneClassName} state={state} />;
  }

  return (
    <div
      data-file-admission-surface="true"
      data-disabled={props.disabled || undefined}
      className={cn(
        "relative flex w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border p-4 text-center transition-colors sm:p-12",
        "hover:border-foreground/30 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        "data-disabled:opacity-50",
        props.dropzoneClassName,
      )}
    >
      <FileDropzone
        disabled={props.disabled}
        multiple={props.multiple}
        onFiles={props.onFiles}
      />
      <ChooseFilesButton
        className={props.buttonClassName}
        disabled={props.disabled}
        label={props.buttonLabel}
        multiple={props.multiple}
        onFiles={props.onFiles}
      />
      <ClipboardAdmissionControl
        disabled={props.disabled ?? false}
        feedback={clipboard.feedback}
        onReadClipboard={() => void clipboard.readClipboard()}
      />
    </div>
  );
}
