import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

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
  const modes: { value: BrushMode; label: string; description: string }[] = [
    { value: "add", label: m.maskAdd(), description: m.maskAddDescription() },
    { value: "erase", label: m.maskErase(), description: m.maskEraseDescription() },
    { value: "restore", label: m.maskRestore(), description: m.maskRestoreDescription() },
  ];
  const activeModeDescription = modes.find(
    (option) => option.value === mode,
  )?.description;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div role="group" aria-label={m.brushMode()} className="flex gap-2">
        {modes.map((option) => (
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
          <span>{m.brushSize()}</span>
          <span className="tabular-nums text-muted-foreground">
            {String(brushSize * 2)} px
          </span>
        </span>
        <input
          type="range"
          aria-label={m.brushSize()}
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
        {m.brushHardness()}
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
          title={`${m.undo()} (Ctrl/Cmd+Z)`}
          disabled={!canUndo}
          onClick={onUndo}
        >
          {m.undo()}
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          title={`${m.redo()} (Ctrl/Cmd+Shift+Z or Ctrl+Y)`}
          disabled={!canRedo}
          onClick={onRedo}
        >
          {m.redo()}
        </Button>
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={m.viewControls()}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={m.zoomOut()}
          title={m.zoomOut()}
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
          aria-label={m.zoomIn()}
          title={m.zoomIn()}
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
          aria-label={m.resetView()}
          title={m.resetView()}
          disabled={zoomPercent === 100 && !canPan}
          onClick={onResetView}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
