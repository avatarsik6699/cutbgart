import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { m } from "@/paraglide/messages";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui";
import type { AutomaticModelMode, BrowserInferencePath } from "@/shared/lib";

export type AutomaticModelControlProps = Readonly<{
  availableModes: readonly AutomaticModelMode[];
  busy: boolean;
  currentMode: AutomaticModelMode | null;
  inferencePath: BrowserInferencePath;
  onFocusRestored?(): void;
  onSelect?(mode: AutomaticModelMode): void;
  processingMode: AutomaticModelMode | null;
  restoreFocus?: boolean;
}>;

function modelLabel(mode: AutomaticModelMode): string {
  switch (mode) {
    case "isnet-q8":
      return m.editorModelIsnetFast();
    case "isnet-fp32":
      return m.editorModelIsnetQuality();
    case "ben2-fp16":
      return m.editorModelBen2Maximum();
  }
}

export function AutomaticModelControl(props: AutomaticModelControlProps) {
  const { busy, onFocusRestored, restoreFocus } = props;
  const effectiveMode = props.processingMode ?? props.currentMode ?? null;
  const [pendingMode, setPendingMode] = useState<AutomaticModelMode | undefined>(
    undefined,
  );
  const [trackedEffectiveMode, setTrackedEffectiveMode] = useState(effectiveMode);
  if (effectiveMode !== trackedEffectiveMode) {
    setTrackedEffectiveMode(effectiveMode);
    setPendingMode(undefined);
  }
  const selectedMode = pendingMode ?? effectiveMode ?? props.availableModes[0];
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedLabel = selectedMode === undefined ? "" : modelLabel(selectedMode);
  const statusLabel = props.busy
    ? m.editorModelProcessingWith({ model: selectedLabel })
    : m.editorModelCurrent({ model: selectedLabel });
  const canReprocess =
    !busy && selectedMode !== undefined && props.onSelect !== undefined;

  useEffect(
    function restoreModelFocusFx() {
      if (!restoreFocus || busy || triggerRef.current === null) return;
      let focusFrame = 0;
      const settleFrame = requestAnimationFrame(() => {
        focusFrame = requestAnimationFrame(() => {
          triggerRef.current?.focus();
          onFocusRestored?.();
        });
      });
      return () => {
        cancelAnimationFrame(settleFrame);
        cancelAnimationFrame(focusFrame);
      };
    },
    [busy, onFocusRestored, restoreFocus],
  );

  return (
    <div
      className="flex shrink-0 items-center"
      data-testid="automatic-model-control"
      data-current-model={props.currentMode ?? "none"}
      data-processing-model={props.processingMode ?? "none"}
    >
      <Menu.Root>
        <Menu.Trigger
          render={
            <Button
              ref={triggerRef}
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              aria-label={statusLabel}
              className="max-w-40 gap-1.5 rounded-r-none border-r-0 px-2 text-xs font-medium"
            />
          }
        >
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{selectedLabel}</span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
            <Menu.Popup className="min-w-48 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
              <Menu.Group>
                <Menu.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {m.editorModelChoiceLabel()}
                </Menu.GroupLabel>
                <Menu.RadioGroup
                  value={selectedMode}
                  onValueChange={(value) => setPendingMode(value as AutomaticModelMode)}
                >
                  {props.availableModes.map((mode) => (
                    <Menu.RadioItem
                      key={mode}
                      value={mode}
                      className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-highlighted:bg-muted"
                    >
                      <span className="flex size-4 items-center justify-center">
                        <Menu.RadioItemIndicator>
                          <Check className="size-4" aria-hidden="true" />
                        </Menu.RadioItemIndicator>
                      </span>
                      {modelLabel(mode)}
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.Group>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canReprocess}
              aria-label={
                selectedMode === undefined
                  ? m.editorModelChoiceLabel()
                  : m.reprocessMode({ mode: modelLabel(selectedMode) })
              }
              className="rounded-l-none px-2"
              onClick={() => {
                if (selectedMode !== undefined) props.onSelect?.(selectedMode);
              }}
            />
          }
        >
          <RefreshCw aria-hidden="true" className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>
          {selectedMode === undefined
            ? m.editorModelChoiceLabel()
            : m.reprocessMode({ mode: modelLabel(selectedMode) })}
        </TooltipContent>
      </Tooltip>
      <span className="font-mono text-[0.625rem] uppercase text-muted-foreground ml-2">
        {props.inferencePath}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {statusLabel}
      </span>
    </div>
  );
}
