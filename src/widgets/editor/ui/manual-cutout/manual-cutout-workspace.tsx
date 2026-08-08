import { useCallback, useRef } from "react";

import type { DocumentHistoryTypes } from "@/editor/domain";
import { CUTOUT_BRUSH_CURSOR_FILL_COLOR } from "../cutout-stage";

import { ManualCutoutCanvas } from "./manual-cutout-canvas";
import { ManualCutoutPanel } from "./manual-cutout-panel";

export type ManualCutoutInteraction = Readonly<{
  apply(): void;
  begin(
    point: Readonly<{ x: number; y: number }>,
    brush: Readonly<{
      mode: DocumentHistoryTypes.ManualMode;
      radius: number;
      hardness: number;
    }>,
  ): void;
  cancel(): void;
  cancelGesture(): void;
  connectCanvas(
    canvas: HTMLCanvasElement,
    sourceUrl: string,
    width: number,
    height: number,
  ): () => void;
  end(): void;
  move(
    point: Readonly<{ x: number; y: number }>,
    brush: Readonly<{
      mode: DocumentHistoryTypes.ManualMode;
      radius: number;
      hardness: number;
    }>,
  ): void;
  readViewState(): Readonly<{
    mode: DocumentHistoryTypes.ManualMode;
    brushSize: number;
    zoom: number;
  }>;
  writeViewState(
    state: Readonly<{
      mode: DocumentHistoryTypes.ManualMode;
      brushSize: number;
      zoom: number;
    }>,
  ): void;
  redo(): void;
  snapshot(): Readonly<{ canRedo: boolean; canUndo: boolean; dirty: boolean }> | null;
  undo(): void;
}>;

export function ManualCutoutWorkspace(
  props: Readonly<{
    backgroundUrl: string | null;
    busy: boolean;
    documentId: string;
    height: number;
    interaction: ManualCutoutInteraction;
    currentUrl: string;
    width: number;
    onCutoutModeChange?(mode: "magic" | "manual"): void;
  }>,
) {
  const cursorRef = useRef<HTMLSpanElement>(null);
  const connectCursor = useCallback((element: HTMLSpanElement | null) => {
    cursorRef.current = element;
  }, []);

  function changeBrushSize(brushSize: number): void {
    const cursor = cursorRef.current;
    if (cursor !== null) {
      cursor.style.width = `${(brushSize * 100) / props.width}%`;
      cursor.style.height = `${(brushSize * 100) / props.height}%`;
    }
    props.interaction.writeViewState({
      ...props.interaction.readViewState(),
      brushSize,
    });
  }

  function changeCursorMode(mode: DocumentHistoryTypes.ManualMode): void {
    const cursor = cursorRef.current;
    if (cursor !== null) {
      cursor.style.backgroundColor = CUTOUT_BRUSH_CURSOR_FILL_COLOR[mode];
    }
  }

  return (
    <>
      <ManualCutoutCanvas
        backgroundUrl={props.backgroundUrl}
        busy={props.busy}
        currentUrl={props.currentUrl}
        documentId={props.documentId}
        height={props.height}
        interaction={props.interaction}
        onCursorElementChange={connectCursor}
        width={props.width}
      />
      <ManualCutoutPanel
        busy={props.busy}
        interaction={props.interaction}
        onBrushSizeChange={changeBrushSize}
        onCutoutModeChange={props.onCutoutModeChange}
        onModeChange={changeCursorMode}
      />
    </>
  );
}
