import { QualityModePopover } from "@/features/quality-mode-toggle";
import { ChooseFilesButton } from "@/features/upload-image";
import { m } from "@/paraglide/messages";
import { Button, Typography } from "@/shared/ui";
import { memo } from "react";

import type { MainPageEditorTypes } from "./main-page-editor.types";
import type { AutomaticModelMode } from "@/shared/lib";

type Props = {
  actions: MainPageEditorTypes.BatchActionsProjection;
  disabled: boolean;
  onAddFiles: (files: readonly File[]) => void;
  onCancelDownloadAll: () => void;
  onChooseQualityMode: (mode: AutomaticModelMode) => void;
  onDownloadAll: () => void;
  qualityMode: AutomaticModelMode | null;
};

function MainPageBatchActionsView(props: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={m.batchActionsAria()}>
      <div
        role="group"
        aria-label={m.batchAdmissionControlsLabel()}
        className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/35 p-1 pl-2"
      >
        <Typography
          variant="caption"
          as="span"
          className="hidden max-w-28 text-muted-foreground sm:inline"
        >
          {m.batchAdmissionModeLabel()}
        </Typography>
        <QualityModePopover
          qualityMode={props.qualityMode}
          onQualityModeChange={props.onChooseQualityMode}
          disabled={props.disabled || props.qualityMode === null}
        />
        <ChooseFilesButton
          className="h-8 w-auto px-3 py-0 sm:flex"
          disabled={
            props.disabled || props.actions.atCapacity || props.qualityMode === null
          }
          label={m.addImages()}
          multiple
          onFiles={props.onAddFiles}
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={props.actions.completedCount === 0 && !props.actions.exporting}
        onClick={
          props.actions.exporting ? props.onCancelDownloadAll : props.onDownloadAll
        }
      >
        {props.actions.exporting ? m.cancel() : m.downloadAllZip()}
      </Button>
    </div>
  );
}

export const MainPageBatchActions = memo(
  MainPageBatchActionsView,
  (previous, next) =>
    previous.disabled === next.disabled &&
    previous.qualityMode === next.qualityMode &&
    previous.onAddFiles === next.onAddFiles &&
    previous.onCancelDownloadAll === next.onCancelDownloadAll &&
    previous.onChooseQualityMode === next.onChooseQualityMode &&
    previous.onDownloadAll === next.onDownloadAll &&
    previous.actions.atCapacity === next.actions.atCapacity &&
    previous.actions.completedCount === next.actions.completedCount &&
    previous.actions.exporting === next.actions.exporting,
);
