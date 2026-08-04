import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { m } from "@/paraglide/messages";

export type BeforeAfterUrlSliderProps = Readonly<{
  afterUrl: string | null;
  alt?: string;
  backgroundStyle?: CSSProperties;
  beforeUrl: string | null;
  height: number;
  onPositionChange?: (position: number) => void;
  position?: number;
  renderImage?: (
    image: Readonly<{ alt: string; decorative: boolean; src: string }>,
  ) => ReactNode;
  transparentBackground?: boolean;
  width: number;
}>;

const STEP_PERCENT = 5;

function renderNativeImage(
  image: Readonly<{ alt: string; decorative: boolean; src: string }>,
) {
  return (
    <img
      src={image.src}
      alt={image.alt}
      aria-hidden={image.decorative || undefined}
      className="h-full w-full object-contain"
    />
  );
}

/** Controller-neutral comparison surface for runtime-owned preview URLs. */
export function BeforeAfterUrlSlider(props: BeforeAfterUrlSliderProps) {
  const afterUrl = props.afterUrl;
  const alt = props.alt ?? m.beforeAfterAlt();
  const backgroundStyle = props.backgroundStyle;
  const beforeUrl = props.beforeUrl;
  const controlledPosition = props.position;
  const onPositionChange = props.onPositionChange;
  const transparentBackground = props.transparentBackground ?? true;
  const renderImage = props.renderImage ?? renderNativeImage;
  const [internalPosition, setInternalPosition] = useState(50);
  const position = controlledPosition ?? internalPosition;
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const setPosition = useCallback(
    (next: number | ((current: number) => number)) => {
      const value = typeof next === "function" ? next(position) : next;
      if (controlledPosition === undefined) setInternalPosition(value);
      onPositionChange?.(value);
    },
    [controlledPosition, onPositionChange, position],
  );

  const updatePositionFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
      setPosition(Math.min(100, Math.max(0, ratio * 100)));
    },
    [setPosition],
  );

  useEffect(
    function trackSliderPointerFx() {
      function handlePointerMove(event: PointerEvent) {
        if (draggingRef.current) updatePositionFromClientX(event.clientX);
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
    },
    [updatePositionFromClientX],
  );

  return (
    <div
      ref={containerRef}
      data-testid="before-after-frame"
      data-fit="contain"
      className="editor-image-frame relative touch-none overflow-hidden rounded-xl bg-muted select-none"
      style={{
        aspectRatio: `${String(props.width)} / ${String(props.height)}`,
        width: `min(100cqw, calc(100cqh * ${String(props.width / props.height)}))`,
        height: `min(100cqh, calc(100cqw / ${String(props.width / props.height)}))`,
      }}
      onPointerDown={(event) => {
        draggingRef.current = true;
        updatePositionFromClientX(event.clientX);
      }}
    >
      {afterUrl !== null ? (
        <div
          className={`absolute inset-0 overflow-hidden ${
            transparentBackground ? "transparency-grid" : ""
          }`}
          data-testid="after-preview-background"
          style={{
            ...backgroundStyle,
            clipPath: `inset(0 ${String(100 - position)}% 0 0)`,
          }}
        >
          {renderImage({ src: afterUrl, alt: "", decorative: true })}
        </div>
      ) : null}
      {beforeUrl !== null ? (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 0 0 ${String(position)}%)` }}
        >
          {renderImage({ src: beforeUrl, alt, decorative: false })}
        </div>
      ) : null}
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
