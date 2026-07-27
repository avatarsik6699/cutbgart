import { Redo2, Trash2, Undo2 } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Button } from "../../../shared/ui";
import type {
  GuidedBrushMode,
  GuidedBrushStatus,
  GuidedBrushViewSession,
} from "../model/types";

interface Props {
  mode: GuidedBrushMode;
  onModeChange: (mode: GuidedBrushMode) => void;
  session: GuidedBrushViewSession;
  status: GuidedBrushStatus;
  applying?: boolean;
  canApply: boolean;
  onBrushRadiusChange: (radius: number) => void;
  onBrushSizeInteraction: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onApply: () => void;
  onCancel: () => void;
}

export function GuidedBrushControls({
  mode,
  onModeChange,
  session,
  status,
  applying = false,
  canApply,
  onBrushRadiusChange,
  onBrushSizeInteraction,
  onUndo,
  onRedo,
  onClear,
  onApply,
  onCancel,
}: Props) {
  const busy =
    applying ||
    status === "loading-model" ||
    status === "encoding-image" ||
    status === "predicting";
  const hasKeep = session.strokes.some((stroke) => stroke.mode === "keep");
  const directKeepMissing = !session.hasBaseMatte && !hasKeep;
  const maxBrushRadius = Math.max(
    session.brushRadius,
    8,
    Math.round(Math.min(session.source.width, session.source.height) / 3),
  );

  return (
    <div className="flex flex-col gap-4" data-testid="guided-brush-controls">
      <div
        className="flex flex-wrap gap-2"
        role="toolbar"
        aria-label={m.guidedBrushModeLabel()}
      >
        <Button
          type="button"
          variant={mode === "keep" ? "default" : "outline"}
          className={
            mode === "keep"
              ? "bg-emerald-700 text-white hover:bg-emerald-800"
              : "border-emerald-700 text-emerald-800 dark:text-emerald-300"
          }
          disabled={busy}
          aria-pressed={mode === "keep"}
          onClick={() => onModeChange("keep")}
        >
          <span aria-hidden="true">＋</span>
          {m.guidedBrushKeep()}
        </Button>
        <Button
          type="button"
          variant={mode === "remove" ? "default" : "outline"}
          className={
            mode === "remove"
              ? "bg-rose-700 text-white hover:bg-rose-800"
              : "border-rose-700 text-rose-800 dark:text-rose-300"
          }
          disabled={busy}
          aria-pressed={mode === "remove"}
          onClick={() => onModeChange("remove")}
        >
          <span aria-hidden="true">−</span>
          {m.guidedBrushRemove()}
        </Button>
      </div>

      <label className="grid max-w-md gap-2 text-sm font-medium">
        <span>
          {m.guidedBrushSize({
            size: String(session.brushRadius * 2),
          })}
        </span>
        <input
          type="range"
          min={2}
          max={maxBrushRadius}
          step={1}
          value={session.brushRadius}
          disabled={busy}
          aria-label={m.guidedBrushSizeLabel()}
          aria-valuetext={`${String(session.brushRadius * 2)} px`}
          onInput={(event) => {
            onBrushRadiusChange(Number(event.currentTarget.value));
            onBrushSizeInteraction();
          }}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={m.guidedBrushUndo()}
          aria-keyshortcuts="Control+Z Meta+Z"
          title={m.guidedBrushUndo()}
          disabled={!session.history.length || busy}
          onClick={onUndo}
        >
          <Undo2 aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={m.guidedBrushRedo()}
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          title={m.guidedBrushRedo()}
          disabled={!session.redo.length || busy}
          onClick={onRedo}
        >
          <Redo2 aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={m.guidedBrushClear()}
          title={m.guidedBrushClear()}
          disabled={!session.strokes.length || busy}
          onClick={onClear}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      {directKeepMissing && session.strokes.length > 0 && (
        <p className="text-xs text-muted-foreground">{m.guidedBrushKeepRequired()}</p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {m.cutoutMagicError()}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!canApply || busy} onClick={onApply}>
          {applying || status === "predicting" ? m.cutoutApplying() : m.cutoutApply()}
        </Button>
        <Button type="button" variant="outline" disabled={applying} onClick={onCancel}>
          {m.cancel()}
        </Button>
      </div>
    </div>
  );
}
