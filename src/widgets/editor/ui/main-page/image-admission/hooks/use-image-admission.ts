import { useCallback } from "react";

import type { FileAdmissionTypes } from "@/features/upload-image";
import { m } from "@/paraglide/messages";

import { admissionErrorText } from "../image-admission.utils";
import type { MainPageEditorTypes } from "../../main-page-editor.types";

type Params = Readonly<{
  error: MainPageEditorTypes.AdmissionError;
  onCancel: () => void;
  onChooseFiles: (files: readonly File[]) => void;
  onRetry: () => void;
  phase: MainPageEditorTypes.Phase;
}>;

type Result = Readonly<{
  chooseFiles: (files: readonly File[]) => void;
  state: FileAdmissionTypes.State;
}>;

export function useImageAdmission(params: Params): Result {
  const onChooseFiles = params.onChooseFiles;
  const chooseFiles = useCallback(
    (files: readonly File[]) => onChooseFiles(files),
    [onChooseFiles],
  );

  switch (params.phase) {
    case "preparing":
      return {
        chooseFiles,
        state: { kind: "preparing", message: m.preparing(), onCancel: params.onCancel },
      };
    case "error":
      return {
        chooseFiles,
        state: {
          kind: "error",
          message: admissionErrorText(params.error),
          onRetry: params.onRetry,
        },
      };
    default:
      return { chooseFiles, state: { kind: "idle" } };
  }
}
