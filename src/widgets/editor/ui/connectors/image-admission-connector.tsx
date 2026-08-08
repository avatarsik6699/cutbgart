import { MainPageIntro } from "@/shared/ui";
import { MainPageImageAdmission, type MainPageEditorTypes } from "../main-page";
import type { EditorSessionTypes } from "@/editor/runtime";

import {
  useEditorSessionSelector,
  useEditorModel,
  useEditorViewSelector,
  type EditorViewSnapshot,
} from "../../model";

const selectSnapshotKind = (snapshot: EditorSessionTypes.Snapshot) => snapshot.kind;
const selectAdmissionError = (snapshot: EditorSessionTypes.Snapshot) => snapshot.error;
const selectQualityMode = (snapshot: EditorViewSnapshot) => snapshot.qualityMode;

function admissionPhase(
  kind: EditorSessionTypes.Snapshot["kind"],
  error: EditorSessionTypes.ImportError | null,
): MainPageEditorTypes.Phase {
  if (error !== null) return "error";
  if (kind === "preparing") return "preparing";
  return "empty";
}

export function ImageAdmissionConnector() {
  const model = useEditorModel();
  const kind = useEditorSessionSelector(selectSnapshotKind);
  const error = useEditorSessionSelector(selectAdmissionError);
  const qualityMode = useEditorViewSelector(selectQualityMode);
  const phase = admissionPhase(kind, error);

  return (
    <div
      data-testid="tool-workspace"
      data-main-page-phase={phase}
      className="tool-workspace-grid tool-workspace-idle"
    >
      <div
        className="[grid-area:intro] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
        data-testid="home-empty-intro"
      >
        <MainPageIntro />
      </div>
      <div className="[grid-area:surface]">
        <MainPageImageAdmission
          error={error}
          onCancel={model.reset}
          onChooseFiles={(files) => void model.admitFiles(files)}
          onChooseQualityMode={model.chooseQualityMode}
          onRetry={model.reset}
          phase={phase}
          qualityMode={qualityMode}
        />
      </div>
    </div>
  );
}
