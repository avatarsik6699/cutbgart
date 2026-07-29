import { CircleMinus, CirclePlus } from "lucide-react";

import type { BrushMode } from "../../../entities/processed-image";
import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";

const MIN_BRUSH_RADIUS = 4;
const MAX_BRUSH_RADIUS = 75;

export interface MaskCorrectionToolbarProps {
  mode: BrushMode;
  onModeChange: (mode: BrushMode) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
}

/**
 * Mode toggle, brush size/hardness, and undo/redo controls (Phase 07,
 * SPEC.md §5.2). All native `<button>`/`<input type="range">` elements —
 * keyboard-operable without any extra wiring (SPEC.md §5.4).
 */
export function MaskCorrectionToolbar({
  mode,
  onModeChange,
  brushSize,
  onBrushSizeChange,
}: MaskCorrectionToolbarProps) {
  const modes: { value: BrushMode; label: string; description: string }[] = [
    {
      value: "add",
      label: m.cutoutManualRestore(),
      description: m.cutoutManualRestoreHint(),
    },
    {
      value: "erase",
      label: m.cutoutManualErase(),
      description: m.cutoutManualEraseHint(),
    },
  ];
  const activeModeDescription = modes.find(
    (option) => option.value === mode,
  )?.description;
  const brushPercent = Math.round(
    ((brushSize - MIN_BRUSH_RADIUS) / (MAX_BRUSH_RADIUS - MIN_BRUSH_RADIUS)) * 100,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div role="group" aria-label={m.brushMode()} className="grid grid-cols-2 gap-2">
        {modes.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={mode === option.value ? "default" : "outline"}
            aria-pressed={mode === option.value}
            title={option.description}
            className={`h-20 flex-col gap-1.5 ${
              mode === option.value
                ? option.value === "add"
                  ? "bg-emerald-700 text-white hover:bg-emerald-800"
                  : "bg-rose-700 text-white hover:bg-rose-800"
                : option.value === "add"
                  ? "border-emerald-700 text-emerald-800 dark:text-emerald-300"
                  : "border-rose-700 text-rose-800 dark:text-rose-300"
            }`}
            onClick={() => {
              onModeChange(option.value);
            }}
          >
            {option.value === "add" ? (
              <CirclePlus className="size-6" aria-hidden="true" />
            ) : (
              <CircleMinus className="size-6" aria-hidden="true" />
            )}
            {option.label}
          </Button>
        ))}
      </div>
      <p className="min-h-10 text-xs text-muted-foreground">{activeModeDescription}</p>

      <label className="flex flex-col gap-1 text-sm">
        <span>{m.brushSize()}</span>
        <input
          type="range"
          aria-label={m.brushSize()}
          aria-valuetext={`${String(brushPercent)}%`}
          min={MIN_BRUSH_RADIUS}
          max={MAX_BRUSH_RADIUS}
          value={brushSize}
          onChange={(event) => {
            onBrushSizeChange(Number(event.target.value));
          }}
        />
      </label>

      <div className="min-h-10" data-testid="manual-cutout-status-slot" />
      <div className="flex-1" aria-hidden="true" />
    </div>
  );
}
