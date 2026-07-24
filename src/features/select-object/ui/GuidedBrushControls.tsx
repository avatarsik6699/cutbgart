import { m } from "@/paraglide/messages";
import { Button } from "../../../shared/ui";
import {
  GUIDED_BRUSH_POINT_LIMIT,
  GUIDED_BRUSH_STROKE_LIMIT,
} from "../model/guided-brush-session";
import { GUIDED_BRUSH_HARD_CORE_RATIO } from "../model/guided-brush-sampling";
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
  canAccept: boolean;
  onBrushRadiusChange: (radius: number) => void;
  onSelectCandidate: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onRecompute: () => void;
  onContinueFromResult: () => void;
  onAccept: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

export function GuidedBrushControls({
  mode,
  onModeChange,
  session,
  status,
  applying = false,
  canAccept,
  onBrushRadiusChange,
  onSelectCandidate,
  onUndo,
  onRedo,
  onClear,
  onRecompute,
  onContinueFromResult,
  onAccept,
  onRetry,
  onCancel,
}: Props) {
  const busy =
    applying ||
    status === "loading-model" ||
    status === "encoding-image" ||
    status === "predicting";
  const hasKeep = session.strokes.some((stroke) => stroke.mode === "keep");
  const directKeepMissing = !session.hasBaseMatte && !hasKeep;
  const canRecompute = session.strokes.length > 0 && !directKeepMissing && !busy;
  const selectedIndex = session.candidates.findIndex(
    (candidate) => candidate.id === session.selectedCandidateId,
  );
  const selectedCandidate =
    selectedIndex >= 0 ? session.candidates[selectedIndex] : undefined;
  const referenceCandidate = session.candidates[0];
  const intentSupportsBest =
    session.candidates.length > 1 &&
    session.candidates[0]!.intentScore >
      (session.candidates[1]?.intentScore ?? -Infinity);
  const maxBrushRadius = Math.max(
    session.brushRadius,
    8,
    Math.round(Math.min(session.source.width, session.source.height) / 3),
  );
  const previewDiameter = Math.round(
    10 + (38 * (session.brushRadius - 2)) / Math.max(1, maxBrushRadius - 2),
  );
  const previewCoreDiameter = Math.max(
    4,
    Math.round(previewDiameter * GUIDED_BRUSH_HARD_CORE_RATIO),
  );
  const candidateDescription =
    session.candidates.length === 1
      ? m.guidedBrushCandidatesCollapsed()
      : selectedIndex === 0
        ? intentSupportsBest
          ? m.guidedBrushBestMatch()
          : m.guidedBrushPrimaryResult()
        : selectedCandidate && referenceCandidate
          ? selectedCandidate.foregroundRatio < referenceCandidate.foregroundRatio - 0.005
            ? m.guidedBrushTighterResult()
            : selectedCandidate.foregroundRatio >
                referenceCandidate.foregroundRatio + 0.005
              ? m.guidedBrushWiderResult()
              : m.guidedBrushAlternateBoundary()
          : m.guidedBrushAlternateBoundary();

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

      <div className="flex max-w-md items-center gap-4">
        <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium">
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
            onChange={(event) => onBrushRadiusChange(Number(event.currentTarget.value))}
          />
        </label>
        <span
          className="grid size-14 shrink-0 place-items-center rounded-lg border bg-muted/40"
          title={m.guidedBrushSizePreview({
            size: String(session.brushRadius * 2),
          })}
          data-testid="guided-brush-size-preview"
        >
          <span
            aria-hidden="true"
            data-testid="guided-brush-size-swatch"
            className={`relative grid place-items-center rounded-full border-2 border-dashed ${mode === "keep" ? "border-emerald-800 bg-emerald-500/15" : "border-rose-800 bg-rose-500/15"}`}
            style={{ width: previewDiameter, height: previewDiameter }}
          >
            <span
              data-testid="guided-brush-core-size-swatch"
              className={`absolute rounded-full border ${mode === "keep" ? "border-emerald-900 bg-emerald-600/65" : "border-rose-900 bg-rose-600/65"}`}
              style={{ width: previewCoreDiameter, height: previewCoreDiameter }}
            />
          </span>
          <span className="sr-only">
            {m.guidedBrushSizePreview({
              size: String(session.brushRadius * 2),
            })}
          </span>
        </span>
      </div>
      <p
        className="max-w-2xl text-xs text-muted-foreground"
        data-testid="guided-brush-tolerance-hint"
      >
        {m.guidedBrushToleranceHint()}
      </p>

      {session.candidates.length > 0 && (
        <section
          className="space-y-2 rounded-xl border bg-muted/25 p-3"
          data-testid="guided-brush-candidates"
          data-candidate-count={session.candidates.length}
          aria-labelledby="guided-brush-result-title"
        >
          <div>
            <h3 id="guided-brush-result-title" className="text-sm font-medium">
              {m.guidedBrushResultTitle()}
            </h3>
            <p
              role="status"
              aria-live="polite"
              className="text-xs text-muted-foreground"
              data-testid="guided-brush-current-result"
              data-candidate-id={selectedCandidate?.id}
            >
              {m.guidedBrushResultPosition({
                current: String(selectedIndex + 1),
                total: String(session.candidates.length),
              })}
              {" · "}
              {candidateDescription}
            </p>
          </div>
          {session.candidates.length > 1 && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={selectedIndex <= 0 || busy}
                  onClick={() => {
                    const previous = session.candidates[selectedIndex - 1];
                    if (previous) onSelectCandidate(previous.id);
                  }}
                >
                  {m.guidedBrushPreviousResult()}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    selectedIndex < 0 ||
                    selectedIndex >= session.candidates.length - 1 ||
                    busy
                  }
                  onClick={() => {
                    const next = session.candidates[selectedIndex + 1];
                    if (next) onSelectCandidate(next.id);
                  }}
                >
                  {m.guidedBrushNextResult()}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {m.guidedBrushResultHistoryHint()}
              </p>
            </>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!session.history.length || busy}
          onClick={onUndo}
        >
          {m.guidedBrushUndo()}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!session.redo.length || busy}
          onClick={onRedo}
        >
          {m.guidedBrushRedo()}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!session.strokes.length || busy}
          onClick={onClear}
        >
          {m.guidedBrushClear()}
        </Button>
        <Button type="button" disabled={!canRecompute} onClick={onRecompute}>
          {busy && status === "predicting"
            ? m.guidedBrushRecomputing()
            : m.guidedBrushRecompute()}
        </Button>
        <Button type="button" disabled={!canAccept || busy} onClick={onAccept}>
          {m.guidedAccept()}
        </Button>
        {canAccept && session.candidates.length > 0 && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onContinueFromResult}
          >
            {m.guidedBrushContinue()}
          </Button>
        )}
        {status === "error" && (
          <Button type="button" variant="outline" onClick={onRetry}>
            {m.tryAgain()}
          </Button>
        )}
        <Button type="button" variant="ghost" disabled={applying} onClick={onCancel}>
          {m.guidedCancel()}
        </Button>
      </div>

      {directKeepMissing && (
        <p className="text-xs text-muted-foreground">{m.guidedBrushKeepRequired()}</p>
      )}
      <p className="text-xs text-muted-foreground" data-testid="guided-brush-limits">
        {m.guidedBrushLimits({
          used: String(session.strokes.length),
          strokes: String(GUIDED_BRUSH_STROKE_LIMIT),
          points: String(GUIDED_BRUSH_POINT_LIMIT),
          prompts: "32",
        })}
      </p>
      <p className="text-xs text-muted-foreground">{m.guidedBrushNoAutoRun()}</p>
      {canAccept && session.candidates.length > 0 && (
        <p className="text-xs text-muted-foreground">{m.guidedBrushContinueHint()}</p>
      )}
    </div>
  );
}
