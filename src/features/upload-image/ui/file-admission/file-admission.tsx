import { ChooseFilesButton } from "./components/choose-files-button";
import { FileDropzone } from "./components/file-dropzone";
import { FileAdmissionStatus } from "./components/file-admission-status";
import type { FileAdmissionTypes } from "./file-admission.types";

const IDLE_STATE: FileAdmissionTypes.State = { kind: "idle" };

export function FileAdmission(props: FileAdmissionTypes.Props) {
  const { state = IDLE_STATE } = props;

  if (state.kind !== "idle") {
    return <FileAdmissionStatus className={props.dropzoneClassName} state={state} />;
  }

  return (
    <>
      <FileDropzone
        className={props.dropzoneClassName}
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
    </>
  );
}
