import { QualityModePopover } from "@/features/quality-mode-toggle";
import { ChooseFilesButton } from "@/features/upload-image";
import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import { memo } from "react";
import { batchMainPageProjectionEqual } from "./main-page-editor-contract";

import type {
  BatchMainPageIntent,
  BatchMainPageProjection,
  MainPageEditorIntent,
  MainPageEditorProjection,
} from "./main-page-editor-contract";

type Props = {
  batch: BatchMainPageProjection;
  disabled: boolean;
  onBatchIntent: (intent: BatchMainPageIntent) => void;
  onEditorIntent: (intent: MainPageEditorIntent) => void;
  qualityMode: MainPageEditorProjection["qualityMode"];
};

function MainPageBatchActionsView(props: Props) {
  const exporting = props.batch.export.status === "preparing";
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={m.batchActionsAria()}>
      <QualityModePopover
        qualityMode={props.qualityMode}
        onQualityModeChange={(mode) =>
          props.onEditorIntent({ type: "choose-quality", mode })
        }
        disabled={props.disabled}
      />
      <ChooseFilesButton
        className="h-8 w-auto px-3 py-0 sm:flex"
        disabled={
          props.disabled || props.batch.capacity.current >= props.batch.capacity.limit
        }
        label={m.addImages()}
        multiple
        onFiles={(files) => props.onBatchIntent({ type: "add-files", files })}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={props.batch.counts.completed === 0 && !exporting}
        onClick={() =>
          props.onBatchIntent({
            type: exporting ? "cancel-download-all" : "download-all",
          })
        }
      >
        {exporting ? m.cancel() : m.downloadAllZip()}
      </Button>
    </div>
  );
}

export const MainPageBatchActions = memo(
  MainPageBatchActionsView,
  (previous, next) =>
    previous.disabled === next.disabled &&
    previous.qualityMode === next.qualityMode &&
    previous.onBatchIntent === next.onBatchIntent &&
    previous.onEditorIntent === next.onEditorIntent &&
    batchMainPageProjectionEqual(previous.batch, next.batch),
);
