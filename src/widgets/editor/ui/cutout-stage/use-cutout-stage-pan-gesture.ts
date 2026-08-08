import { useEffect, useEffectEvent, useRef, type RefObject } from "react";

import type { CanvasInteractionMode } from "../editor-tools";
import { isEditableCanvasShortcutTarget } from "./cutout-stage-geometry";
import type { CutoutStagePanController } from "./cutout-stage-pan-controller";

function panCursor(
  interactionMode: CanvasInteractionMode,
  spacePressed: boolean,
  panning: boolean,
): "grab" | "grabbing" | "none" {
  if (panning) return "grabbing";
  if (interactionMode === "hand" || spacePressed) return "grab";
  return "none";
}

function applyPanVisualState(
  viewport: HTMLDivElement | null,
  interactionMode: CanvasInteractionMode,
  spacePressed: boolean,
  panning: boolean,
): void {
  if (viewport === null) return;
  viewport.dataset.spacePanning = String(spacePressed);
  viewport.dataset.panning = String(panning);
  const canvas = viewport.querySelector<HTMLCanvasElement>("[data-cutout-canvas]");
  if (canvas !== null)
    canvas.style.cursor = panCursor(interactionMode, spacePressed, panning);
  if (!spacePressed && !panning) return;
  const brushCursor = viewport.querySelector<HTMLElement>("[data-brush-cursor]");
  if (brushCursor !== null) brushCursor.hidden = true;
}

export function useCutoutStagePanGesture(
  options: Readonly<{
    disabled: boolean;
    interactionMode: CanvasInteractionMode;
    isViewportActive(): boolean;
    panController: CutoutStagePanController;
    viewportRef: RefObject<HTMLDivElement | null>;
  }>,
) {
  const spacePressedRef = useRef(false);
  const panningRef = useRef(false);
  const syncVisualFx = useEffectEvent(function syncCutoutPanVisualFx(): void {
    applyPanVisualState(
      options.viewportRef.current,
      options.interactionMode,
      spacePressedRef.current,
      panningRef.current,
    );
  });
  const handleKeyDownFx = useEffectEvent(function handleCutoutSpaceDownFx(
    event: KeyboardEvent,
  ): void {
    if (
      options.disabled ||
      event.key !== " " ||
      !options.isViewportActive() ||
      isEditableCanvasShortcutTarget(event.target)
    )
      return;
    event.preventDefault();
    if (event.repeat || spacePressedRef.current) return;
    spacePressedRef.current = true;
    syncVisualFx();
  });
  const releaseSpaceFx = useEffectEvent(function releaseCutoutSpaceFx(
    event?: KeyboardEvent,
  ): void {
    if (event !== undefined && event.key !== " ") return;
    spacePressedRef.current = false;
    if (event === undefined) {
      panningRef.current = false;
      options.panController.stop();
    }
    syncVisualFx();
  });

  useEffect(function routeCutoutSpacePanFx() {
    const keyUpFx = (event: KeyboardEvent) => releaseSpaceFx(event);
    const blurFx = () => releaseSpaceFx();
    globalThis.addEventListener("keydown", handleKeyDownFx);
    globalThis.addEventListener("keyup", keyUpFx);
    globalThis.addEventListener("blur", blurFx);
    return function removeCutoutSpacePanFx() {
      releaseSpaceFx();
      globalThis.removeEventListener("keydown", handleKeyDownFx);
      globalThis.removeEventListener("keyup", keyUpFx);
      globalThis.removeEventListener("blur", blurFx);
    };
  }, []);

  useEffect(
    function synchronizeCutoutPanModeFx() {
      if (options.disabled) {
        spacePressedRef.current = false;
        panningRef.current = false;
        options.panController.stop();
      }
      syncVisualFx();
    },
    [options.disabled, options.interactionMode, options.panController],
  );

  return {
    isSpacePressed: () => spacePressedRef.current,
    setPanning(nextPanning: boolean): void {
      panningRef.current = nextPanning;
      applyPanVisualState(
        options.viewportRef.current,
        options.interactionMode,
        spacePressedRef.current,
        panningRef.current,
      );
    },
  } as const;
}
