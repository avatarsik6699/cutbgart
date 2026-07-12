import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

import type { BrushMode } from "../../../entities/processed-image";
import { Button } from "@/shared/ui";

const MODES: { value: BrushMode; label: string; description: string }[] = [
  {
    value: "add",
    label: "Add",
    description:
      "Paint fully opaque — always keeps the area, even where the AI removed it.",
  },
  {
    value: "erase",
    label: "Erase",
    description:
      "Paint fully transparent — always removes the area, even where the AI kept it.",
  },
  {
    value: "restore",
    label: "Restore",
    description:
      "Reset the area back to the AI's original edge — use this to bring back soft " +
      "details (like hair) instead of forcing them fully opaque with Add.",
  },
];

const MIN_BRUSH_RADIUS = 4;
const MAX_BRUSH_RADIUS = 75;

export interface MaskCorrectionToolbarProps {
  mode: BrushMode;
  onModeChange: (mode: BrushMode) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  brushHardness: number;
  onBrushHardnessChange: (hardness: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoomPercent: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  canPan: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
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
  brushHardness,
  onBrushHardnessChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoomPercent,
  canZoomIn,
  canZoomOut,
  canPan,
  onZoomIn,
  onZoomOut,
  onResetView,
}: MaskCorrectionToolbarProps) {
  const activeModeDescription = MODES.find(
    (option) => option.value === mode,
  )?.description;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div role="group" aria-label="Brush mode" className="flex gap-2">
        {MODES.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={mode === option.value ? "default" : "outline"}
            aria-pressed={mode === option.value}
            title={option.description}
            onClick={() => {
              onModeChange(option.value);
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {activeModeDescription && (
        <p className="text-xs text-muted-foreground">{activeModeDescription}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="flex justify-between gap-3">
          <span>Brush size</span>
          <span className="tabular-nums text-muted-foreground">
            {String(brushSize * 2)} px
          </span>
        </span>
        <input
          type="range"
          aria-label="Brush size"
          aria-valuetext={`${String(brushSize * 2)} px diameter`}
          min={MIN_BRUSH_RADIUS}
          max={MAX_BRUSH_RADIUS}
          value={brushSize}
          onChange={(event) => {
            onBrushSizeChange(Number(event.target.value));
          }}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Brush hardness
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={brushHardness}
          onChange={(event) => {
            onBrushHardnessChange(Number(event.target.value));
          }}
        />
      </label>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          aria-keyshortcuts="Control+Z Meta+Z"
          title="Undo (Ctrl/Cmd+Z)"
          disabled={!canUndo}
          onClick={onUndo}
        >
          Undo
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)"
          disabled={!canRedo}
          onClick={onRedo}
        >
          Redo
        </Button>
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="View controls"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={!canZoomOut}
          onClick={() => {
            onZoomOut();
          }}
        >
          <ZoomOut aria-hidden="true" />
        </Button>
        <span
          className="min-w-16 rounded-md border border-border bg-muted/40 px-2 py-1 text-center text-sm tabular-nums"
          aria-label={`Zoom ${String(zoomPercent)}%${canPan ? ", panned" : ""}`}
        >
          {zoomPercent}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={!canZoomIn}
          onClick={() => {
            onZoomIn();
          }}
        >
          <ZoomIn aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Reset view"
          title="Reset view"
          disabled={zoomPercent === 100 && !canPan}
          onClick={onResetView}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
