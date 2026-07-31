import type { InferencePath } from "../../../entities/processed-image";
import { Button, InlineStatusNotice, ProgressBar } from "../../../shared/ui";
import { MATTING_MODELS, recommendMattingMode } from "../model/model-registry";
import type {
  MattingRefinementMode,
  MattingRefinementStatus,
  MattingFallback,
} from "../model/types";
import { m } from "@/paraglide/messages";

/**
 * @deprecated Not rendered anywhere in production — `EnhancementsToolPanel`
 * (`widgets/tool-workspace`) drives this feature's business logic
 * (`useMatteRefinement`) through its own generic progress/error UI instead.
 * The Balanced/Maximum mode radio buttons this component offers are
 * unreachable; the controller auto-selects `refinementMode` once via
 * `recommendMattingMode` and never exposes `setRefinementMode` to any UI.
 * Confirmed intentional by the architect (2026-07-31, PHASE_31 F-19) —
 * auto-select-only is the desired product behavior, not a regression. Kept
 * only for its own test coverage; candidate for deletion (with its tests) in
 * a future phase once nobody needs the historical reference.
 */
export interface MatteRefinementControlsProps {
  mode: MattingRefinementMode;
  path: InferencePath | null;
  status: MattingRefinementStatus;
  progress: number | null;
  fallbackReason: string | null;
  fallback: MattingFallback | null;
  disabled?: boolean;
  onModeChange: (mode: MattingRefinementMode) => void;
  onStart: () => void;
  onCancel: () => void;
  onSkip: () => void;
}

/** @deprecated See `MatteRefinementControlsProps` — not rendered in production. */
export function MatteRefinementControls({
  mode,
  path,
  status,
  progress,
  fallbackReason,
  fallback,
  disabled = false,
  onModeChange,
  onStart,
  onCancel,
  onSkip,
}: MatteRefinementControlsProps) {
  const busy = [
    "preparing",
    "loading-model",
    "refining",
    "applying",
    "fallback",
  ].includes(status);
  const recommendation = recommendMattingMode(path);
  return (
    <section
      className="space-y-3 rounded-xl border bg-muted/20 p-4"
      aria-labelledby="matte-refinement-title"
      data-testid="matte-refinement-controls"
    >
      <div>
        <h3 id="matte-refinement-title" className="text-sm font-semibold">
          {m.matteRefinementTitle()}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{m.matteRefinementHint()}</p>
      </div>
      <fieldset disabled={busy || disabled} className="space-y-2">
        <legend className="sr-only">{m.matteRefinementModeLabel()}</legend>
        {MATTING_MODELS.map((profile) => (
          <label
            key={profile.mode}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input
              type="radio"
              name="matting-refinement-mode"
              value={profile.mode}
              checked={mode === profile.mode}
              onChange={() => onModeChange(profile.mode)}
              className="mt-1"
            />
            <span className="min-w-0 text-sm">
              <span className="block font-medium">
                {profile.mode === "balanced"
                  ? m.matteRefinementBalanced()
                  : m.matteRefinementMaximum()}
                {recommendation === profile.mode ? ` · ${m.recommended()}` : ""}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {profile.mode === "balanced"
                  ? m.matteRefinementBalancedHint()
                  : m.matteRefinementMaximumHint()}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {(fallbackReason || fallback === "deterministic") && (
        <InlineStatusNotice>
          {fallback === "deterministic"
            ? m.matteRefinementDeterministicFallback()
            : fallback === "wasm"
              ? m.matteRefinementWasmFallback()
              : m.matteRefinementFallback()}
        </InlineStatusNotice>
      )}
      {busy && (
        <div className="space-y-2" role="status">
          <p className="text-sm text-muted-foreground">
            {status === "fallback"
              ? fallback === "wasm"
                ? m.matteRefinementWasmFallback()
                : m.matteRefinementFallback()
              : m.matteRefinementProgress({
                  progress: String(Math.round(progress ?? 0)),
                })}
          </p>
          {progress !== null && <ProgressBar value={progress} />}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {busy ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            {m.matteRefinementCancel()}
          </Button>
        ) : (
          <Button type="button" onClick={onStart} disabled={disabled}>
            {status === "result" ? m.matteRefinementAgain() : m.matteRefinementStart()}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={onSkip}
          disabled={busy || disabled}
        >
          {m.matteRefinementSkip()}
        </Button>
      </div>
    </section>
  );
}
