import { Menu } from "@base-ui/react/menu";
import { QUALITY_MODE_OPTIONS } from "@/features/quality-mode-toggle";
import { m } from "@/paraglide/messages";
import { Button, buttonVariants } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { Check, ChevronDown, Plus } from "lucide-react";
import { memo } from "react";

import type { MainPageEditorTypes } from "./main-page-editor.types";
import type { AutomaticModelMode } from "@/shared/lib";

type Props = {
  actions: MainPageEditorTypes.BatchActionsProjection;
  disabled: boolean;
  onAddFiles: (files: readonly File[]) => void;
  onChooseQualityMode: (mode: AutomaticModelMode) => void;
  qualityMode: AutomaticModelMode | null;
};

function MainPageBatchActionsView(props: Props) {
  const modeDisabled = props.disabled || props.qualityMode === null;
  const addDisabled =
    props.disabled || props.actions.atCapacity || props.qualityMode === null;
  const selectedOption =
    props.qualityMode === null
      ? undefined
      : QUALITY_MODE_OPTIONS.find((option) => option.id === props.qualityMode);

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={m.batchActionsAria()}>
      <div
        role="group"
        aria-label={m.batchAdmissionControlsLabel()}
        className="flex shrink-0 items-center"
      >
        <Menu.Root>
          <Menu.Trigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={modeDisabled}
                aria-label={m.editorModelChoiceLabel()}
                className="max-w-40 gap-1.5 rounded-r-none border-r-0 px-2 text-xs font-medium"
              />
            }
          >
            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">
              {selectedOption === undefined ? "" : selectedOption.label()}
            </span>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
              <Menu.Popup className="min-w-48 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
                <Menu.Group>
                  <Menu.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {m.editorModelChoiceLabel()}
                  </Menu.GroupLabel>
                  <Menu.RadioGroup
                    value={props.qualityMode ?? undefined}
                    onValueChange={(value) =>
                      props.onChooseQualityMode(value as AutomaticModelMode)
                    }
                  >
                    {QUALITY_MODE_OPTIONS.map((option) => (
                      <Menu.RadioItem
                        key={option.id}
                        value={option.id}
                        className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-highlighted:bg-muted"
                      >
                        <span className="flex size-4 items-center justify-center">
                          <Menu.RadioItemIndicator>
                            <Check className="size-4" aria-hidden="true" />
                          </Menu.RadioItemIndicator>
                        </span>
                        {option.label()}
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <label
          data-disabled={addDisabled || undefined}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "cursor-pointer gap-1.5 rounded-l-none px-2 text-xs font-medium",
            "data-disabled:pointer-events-none data-disabled:opacity-50",
          )}
        >
          <Plus aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{m.addImages()}</span>
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            disabled={addDisabled}
            className="sr-only"
            onChange={(event) => {
              const files = [...(event.currentTarget.files ?? [])];
              if (files.length > 0) props.onAddFiles(files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

export const MainPageBatchActions = memo(
  MainPageBatchActionsView,
  (previous, next) =>
    previous.disabled === next.disabled &&
    previous.qualityMode === next.qualityMode &&
    previous.onAddFiles === next.onAddFiles &&
    previous.onChooseQualityMode === next.onChooseQualityMode &&
    previous.actions.atCapacity === next.actions.atCapacity,
);
