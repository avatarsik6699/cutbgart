import { useEffect, useEffectEvent, useRef, useState, type FocusEvent } from "react";

export function useCanvasViewportActivity(
  options: Readonly<{
    disabled: boolean;
    onZoomIn(): void;
    onZoomOut(): void;
  }>,
) {
  const [pointerInside, setPointerInside] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const activeRef = useRef(false);
  const wheelFx = useEffectEvent(function routeViewportWheelFx(event: WheelEvent): void {
    if (options.disabled || event.deltaY === 0) return;
    if (event.cancelable) event.preventDefault();
    if (event.deltaY < 0) options.onZoomIn();
    else options.onZoomOut();
  });

  useEffect(
    function connectViewportWheelFx() {
      if (viewport === null) return;
      viewport.addEventListener("wheel", wheelFx, { passive: false });
      return () => viewport.removeEventListener("wheel", wheelFx);
    },
    [viewport],
  );

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      activeRef.current = pointerInside;
      setFocusWithin(false);
    }
  };

  function enterPointer(): void {
    activeRef.current = true;
    setPointerInside(true);
  }

  function leavePointer(): void {
    activeRef.current = focusWithin;
    setPointerInside(false);
  }

  function focusViewport(): void {
    activeRef.current = true;
    setFocusWithin(true);
  }

  return {
    active: pointerInside || focusWithin,
    connectViewport: setViewport,
    isActive: () => activeRef.current,
    onBlur,
    onFocus: focusViewport,
    onPointerEnter: enterPointer,
    onPointerLeave: leavePointer,
  } as const;
}
