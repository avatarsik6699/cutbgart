import { useCallback, useEffect, useMemo, useRef } from "react";

import { selectMagicCandidates, selectMagicDraft } from "@/editor/application";
import type { MagicCutoutTypes } from "@/editor/domain";

import {
  useActiveDocumentActorSelector,
  useActiveDocumentModel,
  useEditorSessionValue,
  selectActiveHeight,
  selectActiveResultUrl,
  selectActiveWidth,
} from "../../model";
import {
  MagicCutoutWorkspace,
  type MagicCutoutInteraction,
} from "./magic-cutout-workspace";

function useMagicApply(
  model: ReturnType<typeof useActiveDocumentModel>,
  draft: MagicCutoutTypes.Draft | null,
  candidates: readonly MagicCutoutTypes.CandidateSummary[],
): () => void {
  const applyRequestRef = useRef<string | null>(null);
  const magicStateRef = useRef({ draft, candidates });

  useEffect(
    function syncMagicApplyStateFx() {
      magicStateRef.current = { draft, candidates };
    },
    [candidates, draft],
  );

  const requestApply = useCallback(
    function requestMagicApplyCommand(): void {
      const current = magicStateRef.current.draft;
      if (current === null || !current.dirty) return;
      if (current.selectedCandidateId !== null) {
        model.editor.session.applyMagic();
        return;
      }
      applyRequestRef.current = `${current.draftId}:${current.draftRevision}`;
      model.editor.session.predictMagic();
    },
    [model],
  );

  useEffect(
    function completeAutomaticMagicApplyFx() {
      const request = applyRequestRef.current;
      if (request === null) return;
      if (
        draft === null ||
        request !== `${draft.draftId}:${draft.draftRevision}` ||
        draft.status === "error"
      ) {
        applyRequestRef.current = null;
        return;
      }
      if (draft.status !== "preview") return;
      if (draft.selectedCandidateId === null) {
        const best = candidates[0];
        if (best !== undefined)
          model.editor.session.selectMagicCandidate(best.candidateId);
        return;
      }
      applyRequestRef.current = null;
      model.editor.session.applyMagic();
    },
    [candidates, draft, model],
  );

  return requestApply;
}

export function MagicCutoutConnector() {
  const model = useActiveDocumentModel();
  const draft = useActiveDocumentActorSelector(selectMagicDraft);
  const candidates = useActiveDocumentActorSelector(selectMagicCandidates);
  const currentUrl = useEditorSessionValue(selectActiveResultUrl);
  const width = useEditorSessionValue(selectActiveWidth);
  const height = useEditorSessionValue(selectActiveHeight);
  const runtimeProgress = useEditorSessionValue((session) => {
    const snapshot = session.getSnapshot();
    return snapshot.kind === "document" ? snapshot.magicProgress : null;
  });
  const requestApply = useMagicApply(model, draft, candidates);

  const interaction = useMemo<MagicCutoutInteraction>(() => {
    const session = model.editor.session;
    return {
      apply: requestApply,
      appendPoint: (point) => session.magicDraft()?.appendPoint(point),
      beginStroke: (input) => session.magicDraft()?.beginStroke(input) ?? false,
      cancel: () => session.cancelMagic(),
      cancelStroke: () => session.magicDraft()?.cancelStroke(),
      commitStroke: () => {
        const committed = session.magicDraft()?.commitStroke() ?? null;
        if (committed !== null) session.notifyMagicChanged();
        return committed !== null;
      },
      displayStrokes: () => session.magicDraft()?.displayStrokes() ?? [],
      readViewState: () => session.magicViewState(),
      redo: () => session.redoMagic(),
      snapshot: () => session.magicDraft()?.snapshot() ?? null,
      undo: () => session.undoMagic(),
      writeViewState: (state) => session.setMagicViewState(state),
    };
  }, [model, requestApply]);

  useEffect(
    function registerMagicHistoryFx() {
      return model.registerDraftHistory({
        redo: interaction.redo,
        undo: interaction.undo,
      });
    },
    [interaction, model],
  );

  if (draft === null || currentUrl === null) return null;
  return (
    <MagicCutoutWorkspace
      draft={draft}
      height={height}
      runtimeProgress={runtimeProgress}
      interaction={interaction}
      currentUrl={currentUrl}
      width={width}
      onCutoutModeChange={(mode) => model.requestCutoutMode(mode)}
    />
  );
}
