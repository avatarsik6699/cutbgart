import { useEffect, useRef } from "react";

import { m } from "@/paraglide/messages";
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
  const selectRef = useRef<HTMLSelectElement>(null);
  const selectedMode =
    props.processingMode ?? props.currentMode ?? props.availableModes[0];
  const selectedLabel = selectedMode === undefined ? "" : modelLabel(selectedMode);
  const statusLabel = props.busy
    ? m.editorModelProcessingWith({ model: selectedLabel })
    : m.editorModelCurrent({ model: selectedLabel });

  useEffect(
    function restoreModelFocusFx() {
      if (!restoreFocus || busy || selectRef.current === null) return;
      let focusFrame = 0;
      const settleFrame = requestAnimationFrame(() => {
        focusFrame = requestAnimationFrame(() => {
          selectRef.current?.focus();
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
      className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1"
      data-testid="automatic-model-control"
      data-current-model={props.currentMode ?? "none"}
      data-processing-model={props.processingMode ?? "none"}
    >
      <label className="sr-only" htmlFor="automatic-model-choice">
        {m.editorModelChoiceLabel()}
      </label>
      <select
        ref={selectRef}
        id="automatic-model-choice"
        aria-label={statusLabel}
        className="max-w-40 bg-transparent text-xs font-medium text-foreground outline-none disabled:cursor-wait disabled:opacity-70"
        disabled={
          props.busy || selectedMode === undefined || props.onSelect === undefined
        }
        value={selectedMode ?? ""}
        onChange={(event) => {
          const mode = props.availableModes.find(
            (candidate) => candidate === event.currentTarget.value,
          );
          if (mode !== undefined) props.onSelect?.(mode);
        }}
      >
        {props.availableModes.map((mode) => (
          <option key={mode} value={mode}>
            {modelLabel(mode)}
          </option>
        ))}
      </select>
      <span className="font-mono text-[0.625rem] uppercase text-muted-foreground">
        {props.inferencePath}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {statusLabel}
      </span>
    </div>
  );
}
