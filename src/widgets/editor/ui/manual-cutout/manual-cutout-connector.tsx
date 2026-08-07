import { useEffect, useMemo, useRef } from "react";

import { selectDocumentStatus, selectManualDraft } from "@/editor/application";
import { loadManualSourceBitmap, type ManualCutoutRuntimeTypes } from "@/editor/runtime";

import {
  useActiveDocumentActorSelector,
  useActiveDocumentModel,
  useEditorSessionValue,
  selectActiveHeight,
  selectActivePreviewUrl,
  selectActiveWidth,
} from "../../model";
import {
  ManualCutoutWorkspace,
  type ManualCutoutInteraction,
} from "./manual-cutout-workspace";

export function ManualCutoutConnector() {
  const model = useActiveDocumentModel();
  const draft = useActiveDocumentActorSelector(selectManualDraft);
  const sourceUrl = useEditorSessionValue(selectActivePreviewUrl);
  const status = useActiveDocumentActorSelector(selectDocumentStatus);
  const width = useEditorSessionValue(selectActiveWidth);
  const height = useEditorSessionValue(selectActiveHeight);
  const canvasBindingRef = useRef<Readonly<{
    bitmap: ImageBitmap;
    canvas: HTMLCanvasElement;
    imageData: ImageData;
    version: number;
  }> | null>(null);
  const canvasVersionRef = useRef(0);
  const interaction = useMemo<ManualCutoutInteraction>(() => {
    const session = model.editor.session;

    function repaintCanvas(box?: ManualCutoutRuntimeTypes.Box): void {
      const binding = canvasBindingRef.current;
      const engine = session.manualDraft();
      if (binding === null || engine === null) return;
      const context = binding.canvas.getContext("2d");
      if (context === null) return;
      engine.applyAlpha(binding.imageData, box);
      if (box === undefined) {
        context.putImageData(binding.imageData, 0, 0);
        return;
      }
      context.putImageData(
        binding.imageData,
        0,
        0,
        box.minX,
        box.minY,
        box.maxX - box.minX + 1,
        box.maxY - box.minY + 1,
      );
    }

    return {
      apply: () => session.applyManual(),
      begin: (point, brush) => {
        const box = session.manualDraft()?.begin(point, brush) ?? null;
        if (box !== null) repaintCanvas(box);
      },
      cancel: () => session.cancelManual(),
      cancelGesture: () => {
        const box = session.manualDraft()?.cancelGesture() ?? null;
        if (box !== null) {
          repaintCanvas(box);
          session.notifyManualDirty();
        }
      },
      connectCanvas: (canvas, sourceUrl, sourceWidth, sourceHeight) => {
        const version = canvasVersionRef.current + 1;
        canvasVersionRef.current = version;
        let active = true;
        canvasBindingRef.current?.bitmap.close();
        canvasBindingRef.current = null;
        void loadManualSourceBitmap(sourceUrl)
          .then(function bindManualCanvasFx(bitmap) {
            if (!active || version !== canvasVersionRef.current) {
              bitmap.close();
              return;
            }
            const context = canvas.getContext("2d");
            if (context === null) {
              bitmap.close();
              return;
            }
            context.drawImage(bitmap, 0, 0, sourceWidth, sourceHeight);
            const imageData = context.getImageData(0, 0, sourceWidth, sourceHeight);
            const restoreAlpha = new Uint8ClampedArray(sourceWidth * sourceHeight);
            for (let index = 0; index < restoreAlpha.length; index += 1)
              restoreAlpha[index] = imageData.data[index * 4 + 3] ?? 0;
            session.manualDraft()?.setRestoreAlpha(restoreAlpha);
            canvasBindingRef.current = {
              bitmap,
              canvas,
              imageData,
              version,
            };
            repaintCanvas();
          })
          .catch(() => undefined);
        return function disconnectManualCanvasFx() {
          active = false;
          if (canvasBindingRef.current?.version !== version) return;
          canvasBindingRef.current.bitmap.close();
          canvasBindingRef.current = null;
        };
      },
      end: () => {
        if (session.manualDraft()?.end() !== null) session.notifyManualDirty();
      },
      move: (point, brush) => {
        const box = session.manualDraft()?.move(point, brush) ?? null;
        if (box !== null) repaintCanvas(box);
      },
      readViewState: () => session.manualViewState(),
      redo: () => {
        const box = session.manualDraft()?.redo() ?? null;
        if (box !== null) {
          repaintCanvas(box);
          session.notifyManualDirty();
        }
      },
      snapshot: () => {
        const engine = session.manualDraft();
        return engine === null
          ? null
          : { canRedo: engine.canRedo, canUndo: engine.canUndo, dirty: engine.dirty };
      },
      undo: () => {
        const box = session.manualDraft()?.undo() ?? null;
        if (box !== null) {
          repaintCanvas(box);
          session.notifyManualDirty();
        }
      },
      writeViewState: (state) => session.setManualViewState(state),
    };
  }, [model]);

  useEffect(
    function registerManualHistoryFx() {
      return model.registerDraftHistory({
        redo: interaction.redo,
        undo: interaction.undo,
      });
    },
    [interaction, model],
  );

  if (draft === null || sourceUrl === null) return null;
  return (
    <ManualCutoutWorkspace
      busy={status === "manual-applying"}
      documentId={draft.documentId}
      height={height}
      interaction={interaction}
      currentUrl={sourceUrl}
      width={width}
      onCutoutModeChange={(mode) => model.requestCutoutMode(mode)}
    />
  );
}
