import { QualityModeToggle } from "@/features/quality-mode-toggle";
import { FileAdmission } from "@/features/upload-image";
import { MainPageEmptySurface } from "@/shared/ui";
import type { AutomaticModelMode } from "@/shared/lib";

import { useImageAdmission } from "./hooks/use-image-admission";
import type { MainPageEditorTypes } from "../main-page-editor.types";

type Props = Readonly<{
  error: MainPageEditorTypes.AdmissionError;
  onCancel: () => void;
  onChooseFiles: (files: readonly File[]) => void;
  onChooseQualityMode: (mode: AutomaticModelMode) => void;
  onRetry: () => void;
  phase: MainPageEditorTypes.Phase;
  qualityMode: AutomaticModelMode | null;
}>;

export function MainPageImageAdmission(props: Props) {
  const admission = useImageAdmission({
    error: props.error,
    onCancel: props.onCancel,
    onChooseFiles: props.onChooseFiles,
    onRetry: props.onRetry,
    phase: props.phase,
  });

  return (
    <MainPageEmptySurface
      QualitySlot={
        <QualityModeToggle
          qualityMode={props.qualityMode}
          onQualityModeChange={props.onChooseQualityMode}
          disabled={props.phase === "preparing"}
        />
      }
      FileAdmissionSlot={
        <FileAdmission
          dropzoneClassName="command-deck-dropzone border border-border bg-background/50 backdrop-blur-sm"
          disabled={props.phase === "preparing"}
          multiple
          onFiles={admission.chooseFiles}
          state={admission.state}
        />
      }
    />
  );
}
