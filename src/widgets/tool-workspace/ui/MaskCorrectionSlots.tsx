import { useEffect, useRef, type ReactNode, type RefObject } from "react";

import type {
  AlphaMatte,
  BackgroundFill,
  SourceImage,
} from "../../../entities/processed-image";
import {
  MaskCorrectionCanvas,
  MaskCorrectionToolbar,
  useMaskCorrection,
  type MaskCanvasHandle,
  type MaskCorrectionViewportControls,
} from "../../../features/correct-mask";
import { Button } from "@/shared/ui";
import { m } from "@/paraglide/messages";
import { BrushSizeStagePreview } from "./BrushSizeStagePreview";
import type { CanvasInteractionMode } from "./CanvasViewControls";

export interface MaskCorrectionSlotsProps {
  sourceImage: SourceImage;
  originalMatte: AlphaMatte;
  backgroundFill?: BackgroundFill;
  onDone: (matte: AlphaMatte) => Promise<boolean>;
  doneDisabled?: boolean;
  viewportControls: MaskCorrectionViewportControls;
  surfaceTargetRef: RefObject<HTMLCanvasElement | null>;
  onBrushSizeInteraction: () => void;
  previewInteractionKey: number;
  onViewAnnouncementChange: (announcement: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  interactionMode: CanvasInteractionMode;
  interactionEnabled: boolean;
  draftResetKey: number;
  children: (slots: { surface: ReactNode; rail: ReactNode }) => ReactNode;
}

/**
 * Composes `features/correct-mask`'s hook + canvas + toolbar into the
 * `correcting` state's UI (Phase 07, SPEC.md §5.2/§5.3). Renders via a
 * children-render-prop so the canvas (visual editing surface) and the
 * toolbar/Done button (control rail) can be placed in different grid areas
 * (Phase 12 F4) while keeping `useMaskCorrection` mounted/unmounted exactly
 * once per correction session, same as before this phase's layout change —
 * hoisting the hook to always-mount would let undo/redo history leak across
 * sessions (docs/KNOWN_GOTCHAS.md R4).
 */
export function MaskCorrectionSlots({
  sourceImage,
  originalMatte,
  backgroundFill,
  onDone,
  doneDisabled = false,
  viewportControls,
  surfaceTargetRef,
  onBrushSizeInteraction,
  previewInteractionKey,
  onViewAnnouncementChange,
  onDirtyChange,
  interactionMode,
  interactionEnabled,
  draftResetKey,
  children,
}: MaskCorrectionSlotsProps) {
  const canvasHandleRef = useRef<MaskCanvasHandle>(null);
  const {
    mode,
    setMode,
    brushSize,
    setBrushSize,
    canUndo,
    commitStroke,
    viewport,
    zoomAnnouncement,
    zoomIn,
    zoomOut,
    zoomByWheel,
    resetView,
    panView,
    panBySourcePixels,
    clearDraft,
    commitDraft,
  } = useMaskCorrection(
    canvasHandleRef,
    {
      width: sourceImage.width,
      height: sourceImage.height,
    },
    viewportControls,
    interactionEnabled,
  );
  const initialDraftResetKeyRef = useRef(draftResetKey);

  useEffect(() => {
    if (draftResetKey === initialDraftResetKeyRef.current) return;
    initialDraftResetKeyRef.current = draftResetKey;
    const timeout = window.setTimeout(clearDraft, 0);
    return () => window.clearTimeout(timeout);
  }, [clearDraft, draftResetKey]);

  useEffect(() => {
    onViewAnnouncementChange(zoomAnnouncement);
    return () => {
      onViewAnnouncementChange("");
    };
  }, [onViewAnnouncementChange, zoomAnnouncement]);

  useEffect(() => {
    onDirtyChange(canUndo);
    return () => onDirtyChange(false);
  }, [canUndo, onDirtyChange]);

  const ratio = sourceImage.width / sourceImage.height;
  const surface = (
    <div
      className="editor-image-frame relative"
      style={{
        aspectRatio: `${String(sourceImage.width)} / ${String(sourceImage.height)}`,
        width: `min(100cqw, calc(100cqh * ${String(ratio)}))`,
        height: `min(100cqh, calc(100cqw / ${String(ratio)}))`,
      }}
    >
      <MaskCorrectionCanvas
        ref={canvasHandleRef}
        sourceImage={sourceImage}
        backgroundFill={backgroundFill}
        initialMatte={originalMatte}
        original={originalMatte}
        mode={mode}
        brushRadius={brushSize}
        brushHardness={1}
        viewport={viewport}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onWheelZoom={zoomByWheel}
        onResetView={resetView}
        onPan={panView}
        onPanBySourcePixels={panBySourcePixels}
        onStrokeCommitted={commitStroke}
        stageTargetRef={surfaceTargetRef}
        interactionMode={interactionMode}
        interactionEnabled={interactionEnabled}
      />
      <BrushSizeStagePreview
        sourceDiameter={brushSize * 2}
        sourceWidth={sourceImage.width}
        targetRef={surfaceTargetRef}
        interactionKey={previewInteractionKey}
        tone={mode === "erase" ? "erase" : "restore"}
        coreRatio={1 / 3}
      />
    </div>
  );

  const rail = (
    <div className="flex h-full flex-col gap-4">
      <MaskCorrectionToolbar
        mode={mode}
        onModeChange={setMode}
        brushSize={brushSize}
        onBrushSizeChange={(size) => {
          setBrushSize(size);
          onBrushSizeInteraction();
        }}
      />
      <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
        <Button
          type="button"
          disabled={doneDisabled || !canUndo}
          onClick={() => {
            const matte = canvasHandleRef.current?.extractMatte();
            if (matte)
              void onDone(matte).then((committed) => {
                if (committed) commitDraft();
              });
          }}
        >
          {doneDisabled ? m.cutoutApplying() : m.cutoutApply()}
        </Button>
        <Button type="button" variant="outline" onClick={clearDraft}>
          {m.cancel()}
        </Button>
      </div>
    </div>
  );

  return children({ surface, rail });
}
