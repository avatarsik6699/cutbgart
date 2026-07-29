import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import type {
  EnhancementDraft,
  EnhancementOperationDefinition,
  EnhancementOperationId,
} from "../model/enhancement-operation-registry";

export type EnhancementPanelOutcome = "applied" | "unchanged" | "kept-current" | null;

export interface EnhancementsToolPanelProps {
  registry: readonly EnhancementOperationDefinition[];
  draft: EnhancementDraft;
  progress: number | null;
  activeOperationId: EnhancementOperationId | null;
  outcome: EnhancementPanelOutcome;
  errorCode: "out-of-memory" | "failed" | null;
  disabled?: boolean;
  onOperationChange: (id: EnhancementOperationId, selected: boolean) => void;
  onApply: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

export function EnhancementsToolPanel({
  registry,
  draft,
  progress,
  activeOperationId,
  outcome,
  errorCode,
  disabled = false,
  onOperationChange,
  onApply,
  onCancel,
  onRetry,
}: EnhancementsToolPanelProps) {
  const busy = draft.status === "applying";
  const error = draft.status === "error";
  const selected = new Set(draft.selectedOperationIds);
  const activeLabel = registry.find(({ id }) => id === activeOperationId)?.label;

  return (
    <section
      className="flex flex-col gap-4"
      aria-label={m.enhancementsTitle()}
      data-testid="enhancements-tool-panel"
    >
      <p className="text-sm text-muted-foreground">{m.enhancementsHint()}</p>

      <fieldset className="space-y-2" disabled={busy || disabled}>
        <legend className="sr-only">{m.enhancementsOptionsLabel()}</legend>
        {registry.map((operation) => (
          <label
            key={operation.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input
              type="checkbox"
              checked={selected.has(operation.id)}
              onChange={(event) =>
                onOperationChange(operation.id, event.currentTarget.checked)
              }
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{operation.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {operation.help}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {busy && (
        <div role="status" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {m.enhancementsProgress({
              operation: activeLabel ?? m.enhancementsTitle(),
              progress: String(Math.round(progress ?? 0)),
            })}
          </p>
          {progress !== null && (
            <div
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${String(Math.round(progress))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p>
            {errorCode === "out-of-memory"
              ? m.enhancementsOutOfMemory()
              : m.enhancementsError()}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={onRetry}>
              {m.tryAgain()}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              {m.enhancementsKeepCurrent()}
            </Button>
          </div>
        </div>
      )}

      {!error && outcome && (
        <p
          role="status"
          className="rounded-lg border border-emerald-500/40 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
        >
          {outcome === "applied"
            ? m.enhancementsApplied()
            : outcome === "unchanged"
              ? m.enhancementsUnchanged()
              : m.enhancementsCurrentKept()}
        </p>
      )}

      {!error && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={onApply}
            disabled={disabled || busy || draft.selectedOperationIds.length === 0}
          >
            {busy ? m.enhancementsApplying() : m.enhancementsApply()}
          </Button>
          {busy && (
            <Button type="button" variant="outline" onClick={onCancel}>
              {m.enhancementsStop()}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
