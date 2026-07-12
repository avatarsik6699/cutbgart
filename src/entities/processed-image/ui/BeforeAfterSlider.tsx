import { useCallback, useEffect, useRef, useState } from "react";
import { m } from "@/paraglide/messages";

import type { BackgroundFill, SourceImage } from "../model/types";

export interface BeforeAfterSliderProps {
  before: SourceImage;
  after: Blob;
  backgroundFill?: BackgroundFill;
  alt?: string;
}

/** Mirrors `features/remove-background`'s `useObjectUrls` (RemoveBackgroundTestPanel). */
function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the URL state when the external Blob resource is removed.
      setUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(blob);

    setUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
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
  backgroundFill = { type: "transparent" },
  alt = m.beforeAfterAlt(),
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const beforeUrl = useObjectUrl(before.blob);
  const afterUrl = useObjectUrl(after);
  const backgroundImageUrl = useObjectUrl(
    backgroundFill.type === "image" ? backgroundFill.blob : null,
  );
  const backgroundStyle =
    backgroundFill.type === "color"
      ? { backgroundColor: backgroundFill.value, backgroundImage: "none" }
      : backgroundFill.type === "gradient"
        ? {
            backgroundImage: `${backgroundFill.kind === "linear" ? "linear-gradient(to right" : "radial-gradient(circle at center"}, ${backgroundFill.stops[0].color}, ${backgroundFill.stops[1].color})`,
          }
        : backgroundFill.type === "image" && backgroundImageUrl
          ? {
              backgroundImage: `url("${backgroundImageUrl}")`,
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
            }
          : undefined;

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
      {afterUrl && (
        // Checkerboard backdrop behind the cutout — without it, the "after"
        // PNG's transparent background just let the "before" image (which
        // used to sit directly underneath, unclipped, across the whole
        // container) show through unchanged, making the slider look like it
        // did nothing at all.
        <div
          className={`absolute inset-0 overflow-hidden ${
            backgroundFill.type === "transparent"
              ? "bg-[length:16px_16px] bg-[image:repeating-conic-gradient(var(--color-border)_0%_25%,transparent_0%_50%)]"
              : ""
          }`}
          data-testid="after-preview-background"
          style={{
            ...backgroundStyle,
            clipPath: `inset(0 ${String(100 - position)}% 0 0)`,
          }}
        >
          <img
            src={afterUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain"
          />
        </div>
      )}
      {beforeUrl && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 0 0 ${String(position)}%)` }}
        >
          <img src={beforeUrl} alt={alt} className="h-full w-full object-contain" />
        </div>
      )}
      <div
        role="slider"
        aria-label={m.beforeAfterControl()}
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
