import { CircleMinus, CirclePlus } from "lucide-react";

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
  onApply: () => void;
  onCancel: () => void;
  onRetry: () => void;
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
  onApply,
  onCancel,
  onRetry,
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
  const brushPercent = Math.round(
    ((session.brushRadius - 2) / Math.max(1, maxBrushRadius - 2)) * 100,
  );
  const activeHint =
    mode === "keep" ? m.guidedBrushKeepHint() : m.guidedBrushRemoveHint();

  return (
    <div className="flex h-full flex-col gap-4" data-testid="guided-brush-controls">
      <div
        className="grid grid-cols-2 gap-2"
        role="toolbar"
        aria-label={m.guidedBrushModeLabel()}
      >
        <Button
          type="button"
          variant={mode === "keep" ? "default" : "outline"}
          className={`h-20 flex-col gap-1.5 ${
            mode === "keep"
              ? "bg-emerald-700 text-white hover:bg-emerald-800"
              : "border-emerald-700 text-emerald-800 dark:text-emerald-300"
          }`}
          disabled={busy}
          aria-pressed={mode === "keep"}
          onClick={() => onModeChange("keep")}
        >
          <CirclePlus className="size-6" aria-hidden="true" />
          {m.guidedBrushKeep()}
        </Button>
        <Button
          type="button"
          variant={mode === "remove" ? "default" : "outline"}
          className={`h-20 flex-col gap-1.5 ${
            mode === "remove"
              ? "bg-rose-700 text-white hover:bg-rose-800"
              : "border-rose-700 text-rose-800 dark:text-rose-300"
          }`}
          disabled={busy}
          aria-pressed={mode === "remove"}
          onClick={() => onModeChange("remove")}
        >
          <CircleMinus className="size-6" aria-hidden="true" />
          {m.guidedBrushRemove()}
        </Button>
      </div>

      <p className="min-h-10 text-xs text-muted-foreground">{activeHint}</p>

      <label className="grid max-w-md gap-2 text-sm font-medium">
        <span>{m.brushSize()}</span>
        <input
          type="range"
          min={2}
          max={maxBrushRadius}
          step={1}
          value={session.brushRadius}
          disabled={busy}
          aria-label={m.brushSize()}
          aria-valuetext={`${String(brushPercent)}%`}
          onInput={(event) => {
            onBrushRadiusChange(Number(event.currentTarget.value));
            onBrushSizeInteraction();
          }}
        />
      </label>

      <div className="min-h-10">
        {directKeepMissing && session.strokes.length > 0 && (
          <p className="text-xs text-muted-foreground">{m.guidedBrushKeepRequired()}</p>
        )}
        {status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {m.cutoutMagicError()}
          </p>
        )}
      </div>

      <div className="flex-1" aria-hidden="true" />

      <div className="grid grid-cols-2 gap-2 pt-2">
        {status === "error" ? (
          <Button type="button" className="w-full" onClick={onRetry}>
            {m.tryAgain()}
          </Button>
        ) : (
          <Button
            type="button"
            className="w-full"
            disabled={!canApply || busy}
            onClick={onApply}
          >
            {applying || status === "predicting" ? m.cutoutApplying() : m.cutoutApply()}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={applying}
          onClick={onCancel}
        >
          {m.cancel()}
        </Button>
      </div>
    </div>
  );
}
