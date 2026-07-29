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

const TONE_COLOR = {
  keep: "#15803d",
  remove: "#be123c",
  restore: "#15803d",
  erase: "#be123c",
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
  const color = TONE_COLOR[tone];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-hidden"
      data-testid="brush-size-stage-preview"
      data-visible={visible}
      data-viewport-diameter={diameter}
    >
      <svg
        data-testid="brush-size-stage-preview-ring"
        viewBox="0 0 100 100"
        className="relative overflow-visible transition-[width,height,opacity] duration-150 motion-reduce:transition-none"
        style={{
          width: diameter,
          height: diameter,
          opacity: visible ? 1 : 0,
        }}
      >
        <circle
          cx="50"
          cy="50"
          r="49"
          fill={color}
          fillOpacity="0.08"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="3 2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {coreRatio < 1 && diameter > 0 && (
          <circle
            cx="50"
            cy="50"
            r={(coreDiameter / diameter) * 50}
            fill={color}
            fillOpacity="0.36"
            stroke={color}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}
