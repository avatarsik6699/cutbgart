import type { ReactNode } from "react";

import { m } from "@/paraglide/messages";

export type CutoutMode = "magic" | "manual";
export type CutoutIntent = "keep" | "remove";
export type ManualCutoutMode = "restore" | "erase";

export interface CutoutDraft {
  mode: CutoutMode;
  dirty: boolean;
  canApply: boolean;
  applying: boolean;
}

export interface CutoutToolPanelProps {
  mode: CutoutMode;
  onModeChange: (mode: CutoutMode) => void;
  magicControls: ReactNode;
  manualControls: ReactNode;
}

export function CutoutToolPanel({
  mode,
  onModeChange,
  magicControls,
  manualControls,
}: CutoutToolPanelProps) {
  return (
    <div className="flex flex-col gap-4" data-testid="cutout-tool-panel" data-mode={mode}>
      <div
        className="grid grid-cols-2 rounded-lg bg-muted/60 p-1"
        role="tablist"
        aria-label={m.cutoutModeLabel()}
      >
        {(["magic", "manual"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            id={`cutout-${option}-tab`}
            aria-controls={`cutout-${option}-panel`}
            aria-selected={mode === option}
            tabIndex={mode === option ? 0 : -1}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === option
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onModeChange(option)}
          >
            {option === "magic" ? m.cutoutMagic() : m.cutoutManual()}
          </button>
        ))}
      </div>

      <div
        id="cutout-magic-panel"
        role="tabpanel"
        aria-labelledby="cutout-magic-tab"
        hidden={mode !== "magic"}
      >
        {magicControls}
      </div>
      <div
        id="cutout-manual-panel"
        role="tabpanel"
        aria-labelledby="cutout-manual-tab"
        hidden={mode !== "manual"}
      >
        {manualControls}
      </div>
    </div>
  );
}
