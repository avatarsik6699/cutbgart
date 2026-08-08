import { Paintbrush, WandSparkles } from "lucide-react";

import { m } from "@/paraglide/messages";

import type { CutoutPresentationMode } from "../../model";

export function CutoutModeTabs(
  props: Readonly<{
    mode: CutoutPresentationMode;
    onModeChange(mode: CutoutPresentationMode): void;
  }>,
) {
  return (
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
            aria-selected={props.mode === option}
            tabIndex={props.mode === option ? 0 : -1}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              props.mode === option
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => props.onModeChange(option)}
          >
            <Icon className="size-4" aria-hidden="true" />
            {option === "magic" ? m.cutoutMagic() : m.cutoutManual()}
          </button>
        );
      })}
    </div>
  );
}
