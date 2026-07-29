import { Paintbrush, WandSparkles } from "lucide-react";
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
    <div
      className="flex h-full min-h-0 flex-col gap-5"
      data-testid="cutout-tool-panel"
      data-mode={mode}
    >
      <div
        className="grid grid-cols-2 rounded-xl bg-muted/60 p-1"
        role="tablist"
        aria-label={m.cutoutModeLabel()}
      >
        {(["magic", "manual"] as const).map((option) => {
          const Icon = option === "magic" ? WandSparkles : Paintbrush;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              id={`cutout-${option}-tab`}
              aria-controls={`cutout-${option}-panel`}
              aria-selected={mode === option}
              tabIndex={mode === option ? 0 : -1}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                mode === option
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onModeChange(option)}
            >
              <Icon className="size-4" aria-hidden="true" />
              {option === "magic" ? m.cutoutMagic() : m.cutoutManual()}
            </button>
          );
        })}
      </div>

      <div
        id="cutout-magic-panel"
        role="tabpanel"
        aria-labelledby="cutout-magic-tab"
        hidden={mode !== "magic"}
        className="min-h-0 flex-1"
      >
        {magicControls}
      </div>
      <div
        id="cutout-manual-panel"
        role="tabpanel"
        aria-labelledby="cutout-manual-tab"
        hidden={mode !== "manual"}
        className="min-h-0 flex-1"
      >
        {manualControls}
      </div>
    </div>
  );
}
