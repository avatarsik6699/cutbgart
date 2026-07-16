import { m } from "@/paraglide/messages";
import { Button } from "../../../shared/ui";
import type { ObjectSelectionStatus, PromptSession } from "../model/types";

export type GuidedTool = "positive" | "negative" | "box" | "keep" | "remove";

interface Props {
  tool: GuidedTool;
  onToolChange: (tool: GuidedTool) => void;
  session: PromptSession;
  status: ObjectSelectionStatus;
  canAccept: boolean;
  onAddLayer: () => void;
  onSelectLayer: (id: string) => void;
  onRemoveLayer: (id: string) => void;
  onSelectCandidate: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetLayer: () => void;
  onAccept: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

export function ObjectSelectionControls({
  tool,
  onToolChange,
  session,
  status,
  canAccept,
  onAddLayer,
  onSelectLayer,
  onRemoveLayer,
  onSelectCandidate,
  onUndo,
  onRedo,
  onResetLayer,
  onAccept,
  onRetry,
  onCancel,
}: Props) {
  const active = session.layers.find((layer) => layer.id === session.activeLayerId)!;
  const selectedCandidateIndex = active.candidates.findIndex(
    (candidate) => candidate.id === active.selectedCandidateId,
  );
  const busy =
    status === "loading-model" ||
    status === "encoding-image" ||
    status === "predicting-mask";
  const tools: Array<{ id: GuidedTool; label: string }> = [
    { id: "positive", label: m.guidedPositivePoint() },
    { id: "negative", label: m.guidedNegativePoint() },
    { id: "box", label: m.guidedBox() },
    { id: "keep", label: m.guidedKeepStroke() },
    { id: "remove", label: m.guidedRemoveStroke() },
  ];
  return (
    <div className="flex flex-col gap-4" data-testid="guided-controls">
      <div
        className="flex flex-wrap gap-2"
        role="toolbar"
        aria-label={m.guidedToolLabel()}
      >
        {tools.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={tool === item.id ? "default" : "outline"}
            disabled={busy}
            aria-pressed={tool === item.id}
            onClick={() => onToolChange(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{m.guidedLayers()}</legend>
        <p id="guided-layers-hint" className="max-w-2xl text-xs text-muted-foreground">
          {m.guidedLayersHint()}
        </p>
        <div className="flex flex-wrap gap-2">
          {session.layers.map((layer, index) => (
            <span key={layer.id} className="inline-flex">
              <Button
                type="button"
                variant={layer.id === session.activeLayerId ? "default" : "outline"}
                aria-pressed={layer.id === session.activeLayerId}
                disabled={busy}
                onClick={() => onSelectLayer(layer.id)}
              >
                <span>{m.guidedLayer({ number: String(index + 1) })}</span>
                {layer.id === session.activeLayerId && (
                  <span className="text-xs font-normal opacity-80">
                    {m.guidedActiveLayer()}
                  </span>
                )}
              </Button>
              {session.layers.length > 1 && layer.id === session.activeLayerId && (
                <Button
                  type="button"
                  variant="outline"
                  aria-label={m.guidedRemoveLayer({ number: String(index + 1) })}
                  disabled={busy}
                  onClick={() => onRemoveLayer(layer.id)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {m.guidedRemoveLayer({ number: String(index + 1) })}
                </Button>
              )}
            </span>
          ))}
          <Button type="button" variant="outline" disabled={busy} onClick={onAddLayer}>
            {m.guidedAddLayer()}
          </Button>
        </div>
      </fieldset>

      {active.candidates.length > 1 && (
        <fieldset className="space-y-2" data-testid="guided-candidates">
          <legend className="text-sm font-medium">{m.guidedCandidates()}</legend>
          <p className="max-w-2xl text-xs text-muted-foreground">
            {m.guidedCandidatesHint()}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {active.candidates.map((candidate, index) => (
              <label
                key={candidate.id}
                data-testid={`guided-candidate-${String(index + 1)}`}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${candidate.id === active.selectedCandidateId ? "border-primary bg-primary/5 ring-1 ring-primary" : ""}`}
              >
                <input
                  type="radio"
                  name={`candidate-${active.id}`}
                  checked={candidate.id === active.selectedCandidateId}
                  onChange={() => onSelectCandidate(candidate.id)}
                  className="mt-1"
                />
                <span className="space-y-1">
                  <span className="block font-medium">
                    {m.guidedCandidate({ number: String(index + 1) })}
                    {index === 0 ? ` · ${m.guidedCandidateRecommended()}` : ""}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {candidate.score === null
                      ? m.guidedCandidateScoreUnavailable()
                      : m.guidedCandidateScore({
                          score: String(Math.round(candidate.score * 100)),
                        })}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {index === 0
                      ? m.guidedCandidateReference()
                      : candidate.differenceRatio === 0
                        ? m.guidedCandidateSame()
                        : m.guidedCandidateDifference({
                            difference:
                              candidate.differenceRatio < 0.01
                                ? "<1"
                                : String(Math.round(candidate.differenceRatio * 100)),
                          })}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {selectedCandidateIndex >= 0 && (
            <p role="status" aria-live="polite" className="sr-only">
              {m.guidedCandidateSelected({
                number: String(selectedCandidateIndex + 1),
              })}
            </p>
          )}
        </fieldset>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!session.history.length || busy}
          onClick={onUndo}
        >
          {m.guidedUndo()}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!session.redo.length || busy}
          onClick={onRedo}
        >
          {m.guidedRedo()}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onResetLayer}>
          {m.guidedResetLayer()}
        </Button>
        {canAccept && (
          <Button type="button" onClick={onAccept}>
            {m.guidedAccept()}
          </Button>
        )}
        {status === "error" && (
          <Button type="button" variant="outline" onClick={onRetry}>
            {m.tryAgain()}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancel}>
          {m.guidedCancel()}
        </Button>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{m.guidedLayerActionsHint()}</p>
        <p>{m.guidedShortcutHint()}</p>
      </div>
    </div>
  );
}
