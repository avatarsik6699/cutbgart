import { useEffect, useState, type RefObject } from "react";

import { sourcePixelsToViewportPixels } from "@/shared/lib/brush-geometry";

export interface BrushSizeStagePreviewProps {
  sourceDiameter: number;
  sourceWidth: number;
  targetRef: RefObject<HTMLElement | null>;
  interactionKey: number;
  tone: "keep" | "remove" | "restore" | "erase";
  coreRatio?: number;
}

const TONE_CLASSES = {
  keep: "border-emerald-700 bg-emerald-500/15",
  remove: "border-rose-700 bg-rose-500/15",
  restore: "border-emerald-700 bg-emerald-500/15",
  erase: "border-rose-700 bg-rose-500/15",
} as const;

/**
 * A short-lived, stage-centred representation of the actual source-space
 * brush footprint. `getBoundingClientRect()` includes the active CSS zoom,
 * so this uses the same source-to-viewport scale as cursor and stamp math.
 */
export function BrushSizeStagePreview({
  sourceDiameter,
  sourceWidth,
  targetRef,
  interactionKey,
  tone,
  coreRatio = 1,
}: BrushSizeStagePreviewProps) {
  const [diameter, setDiameter] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (interactionKey <= 0) return;
    const target = targetRef.current;
    if (!target) return;
    const measured = sourcePixelsToViewportPixels(
      sourceDiameter,
      target.getBoundingClientRect().width,
      sourceWidth,
    );
    setDiameter(measured);
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 700);
    return () => window.clearTimeout(timeout);
  }, [interactionKey, sourceDiameter, sourceWidth, targetRef]);

  const coreDiameter = Math.max(1, diameter * Math.min(Math.max(coreRatio, 0), 1));

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-hidden"
      data-testid="brush-size-stage-preview"
      data-visible={visible}
      data-viewport-diameter={diameter}
    >
      <span
        data-testid="brush-size-stage-preview-ring"
        className={`relative rounded-full border-2 border-dashed transition-[width,height,opacity] duration-150 motion-reduce:transition-none ${TONE_CLASSES[tone]}`}
        style={{
          width: diameter,
          height: diameter,
          opacity: visible ? 1 : 0,
        }}
      >
        {coreRatio < 1 && (
          <span
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${TONE_CLASSES[tone]}`}
            style={{ width: coreDiameter, height: coreDiameter }}
          />
        )}
      </span>
    </div>
  );
}
