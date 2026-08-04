import { useMemo } from "react";

import { m } from "@/paraglide/messages";
import { BeforeAfterUrlSlider } from "@/entities/processed-image";
import { EditorStage } from "@/shared/ui";
import type { EnhancementDraft, EnhancementOperationId } from "@/v2/domain";
import type { EnhancementRuntimeSnapshot } from "@/v2/runtime-browser";
import {
  createEnhancementOperationRegistry,
  EnhancementsToolPanel,
  ToolPanelSlot,
  type EnhancementPanelOutcome,
} from "@/widgets/tool-workspace";
import { WorkspaceComparisonImage } from "../editor-tools/workspace-comparison-image";

type Props = {
  draft: EnhancementDraft;
  height: number;
  previewUrl: string;
  runtime: EnhancementRuntimeSnapshot;
  sourceUrl: string;
  interaction: EnhancementInteraction;
  width: number;
};

export type EnhancementInteraction = Readonly<{
  apply(): void;
  cancel(): void;
  change(operationIds: readonly EnhancementOperationId[]): void;
  retry(): void;
}>;

export function EnhancementWorkspace(props: Props) {
  const busy = ["queued", "running", "applying"].includes(props.runtime.status);
  const registry = useMemo(() => createEnhancementOperationRegistry(), []);
  const outcome: EnhancementPanelOutcome =
    props.runtime.status === "no-change" ? "unchanged" : null;
  let panelStatus: "applying" | "error" | "idle" = "idle";
  if (props.runtime.status === "error") panelStatus = "error";
  else if (busy) panelStatus = "applying";

  function toggleOperation(operationId: EnhancementOperationId): void {
    const selected = new Set(props.draft.selectedOperationIds);
    if (selected.has(operationId)) selected.delete(operationId);
    else selected.add(operationId);
    props.interaction.change([...selected]);
  }

  return (
    <>
      <div className="[grid-area:surface]">
        <EditorStage documentId={props.draft.documentId}>
          <BeforeAfterUrlSlider
            afterUrl={props.previewUrl}
            beforeUrl={props.sourceUrl}
            width={props.width}
            height={props.height}
            renderImage={(image) => (
              <WorkspaceComparisonImage
                image={image}
                width={props.width}
                height={props.height}
              />
            )}
          />
        </EditorStage>
      </div>
      <div className="[grid-area:rail]">
        <ToolPanelSlot toolId="enhance" label={m.editorV2EnhancementsTitle()} autoFocus>
          <EnhancementsToolPanel
            registry={registry}
            draft={{
              selectedOperationIds: props.draft.selectedOperationIds,
              improveDetail: props.draft.selectedOperationIds.includes("fine-detail"),
              removeColourHalo: props.draft.selectedOperationIds.includes("colour-halo"),
              dirty: props.draft.dirty,
              status: panelStatus,
            }}
            progress={
              props.runtime.fraction === null
                ? null
                : Math.round(props.runtime.fraction * 100)
            }
            activeOperationId={props.runtime.activeOperationId}
            outcome={outcome}
            errorCode={props.runtime.status === "error" ? "failed" : null}
            cancelVisible
            retryVisible={props.runtime.status === "no-change"}
            onOperationChange={(operationId) => toggleOperation(operationId)}
            onApply={() => props.interaction.apply()}
            onCancel={() => props.interaction.cancel()}
            onRetry={() => props.interaction.retry()}
          />
        </ToolPanelSlot>
      </div>
    </>
  );
}
