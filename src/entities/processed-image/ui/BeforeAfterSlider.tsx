import { useCallback, useEffect, useRef, useState } from "react";

import type { SourceImage } from "../model/types";

export interface BeforeAfterSliderProps {
  before: SourceImage;
  after: Blob;
  alt?: string;
}

/** Mirrors `features/remove-background`'s `useObjectUrls` (RemoveBackgroundTestPanel). */
function useObjectUrl(blob: Blob): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizing React state with an externally-owned Blob URL (an external system), not deriving state from props.
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  return url;
}

const STEP_PERCENT = 5;

/**
 * Draggable/keyboard-operable before/after comparison (SPEC.md §5.2, §5.3
 * "result" state). Reveals `after` over `before` up to a pointer- or
 * arrow-key-controlled position; the handle is a real `role="slider"` so it
 * meets the WCAG AA interactive-element requirement (SPEC.md §5.4).
 */
export function BeforeAfterSlider({
  before,
  after,
  alt = "Image before and after background removal",
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const beforeUrl = useObjectUrl(before.blob);
  const afterUrl = useObjectUrl(after);

  const updatePositionFromClientX = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
    setPosition(Math.min(100, Math.max(0, ratio * 100)));
  }, []);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!draggingRef.current) return;
      updatePositionFromClientX(event.clientX);
    }
    function handlePointerUp() {
      draggingRef.current = false;
    }
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [updatePositionFromClientX]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full max-w-xl touch-none overflow-hidden rounded-xl bg-muted select-none"
      onPointerDown={(event) => {
        draggingRef.current = true;
        updatePositionFromClientX(event.clientX);
      }}
    >
      {beforeUrl && (
        <img
          src={beforeUrl}
          alt={alt}
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}
      {afterUrl && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${String(100 - position)}% 0 0)` }}
        >
          <img
            src={afterUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain"
          />
        </div>
      )}
      <div
        role="slider"
        aria-label="Before/after comparison position"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        className="group absolute inset-y-0 flex w-8 -translate-x-1/2 cursor-ew-resize items-center justify-center focus-visible:outline-none"
        style={{ left: `${String(position)}%` }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setPosition((current) => Math.max(0, current - STEP_PERCENT));
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            setPosition((current) => Math.min(100, current + STEP_PERCENT));
          } else if (event.key === "Home") {
            event.preventDefault();
            setPosition(0);
          } else if (event.key === "End") {
            event.preventDefault();
            setPosition(100);
          }
        }}
      >
        <div className="h-full w-0.5 bg-background shadow" aria-hidden="true" />
        <div
          className="absolute size-8 rounded-full border-2 border-background bg-primary shadow group-focus-visible:ring-3 group-focus-visible:ring-ring/50"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
