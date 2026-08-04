import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import type { ManualCutoutMode } from "@/v2/domain";
import {
  loadManualSourceBitmap,
  installManualDraftUnloadGuard,
  type EditorSession,
  type ManualCutoutBox,
} from "@/v2/runtime-browser";
import { Typography } from "@/v2/shared/ui";

type Props = {
  height: number;
  session: EditorSession;
  sourceUrl: string;
  width: number;
};

type Cursor = { x: number; y: number } | null;

export function ManualCutoutWorkspace(props: Props) {
  const initialView = props.session.manualViewState();
  const [mode, setMode] = useState<ManualCutoutMode>(initialView.mode);
  const [brushSize, setBrushSize] = useState(initialView.brushSize);
  const [zoom, setZoom] = useState(initialView.zoom);
  const [cursor, setCursor] = useState<Cursor>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const engine = props.session.manualDraft();

  function changeMode(nextMode: ManualCutoutMode): void {
    setMode(nextMode);
    props.session.setManualViewState({ mode: nextMode, brushSize, zoom });
  }

  function changeBrushSize(nextBrushSize: number): void {
    setBrushSize(nextBrushSize);
    props.session.setManualViewState({ mode, brushSize: nextBrushSize, zoom });
  }

  function changeZoom(update: (value: number) => number): void {
    setZoom((current) => {
      const nextZoom = update(current);
      props.session.setManualViewState({ mode, brushSize, zoom: nextZoom });
      return nextZoom;
    });
  }

  const repaint = useCallback(
    function repaintManualCanvas(box?: ManualCutoutBox): void {
      const canvas = canvasRef.current;
      const imageData = imageDataRef.current;
      if (canvas === null || imageData === null || engine === null) return;
      const context = canvas.getContext("2d");
      if (context === null) return;
      engine.applyAlpha(imageData, box);
      if (box === undefined) {
        context.putImageData(imageData, 0, 0);
      } else {
        context.putImageData(
          imageData,
          0,
          0,
          box.minX,
          box.minY,
          box.maxX - box.minX + 1,
          box.maxY - box.minY + 1,
        );
      }
    },
    [engine],
  );

  function sourcePoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * props.width,
      y: ((event.clientY - box.top) / box.height) * props.height,
    };
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (engine === null || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = sourcePoint(event);
    repaint(
      engine.begin(point, { mode, radius: brushSize / 2, hardness: 0.72 }) ?? undefined,
    );
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const point = sourcePoint(event);
    setCursor(point);
    if (engine === null || !event.currentTarget.hasPointerCapture(event.pointerId))
      return;
    repaint(
      engine.move(point, { mode, radius: brushSize / 2, hardness: 0.72 }) ?? undefined,
    );
  }

  function pointerUp(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (engine === null || !event.currentTarget.hasPointerCapture(event.pointerId))
      return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    engine.end();
    props.session.notifyManualDirty();
  }

  function pointerCancel(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (engine === null) return;
    repaint(engine.cancelGesture() ?? undefined);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    props.session.notifyManualDirty();
  }

  const undo = useCallback(
    function undoManualGesture(): void {
      const box = engine?.undo() ?? null;
      if (box !== null) {
        repaint(box);
        props.session.notifyManualDirty();
      }
    },
    [engine, props.session, repaint],
  );

  const redo = useCallback(
    function redoManualGesture(): void {
      const box = engine?.redo() ?? null;
      if (box !== null) {
        repaint(box);
        props.session.notifyManualDirty();
      }
    },
    [engine, props.session, repaint],
  );

  useEffect(
    function loadManualSourceFx() {
      const canvas = canvasRef.current;
      if (canvas === null || engine === null) return;
      let active = true;
      let bitmap: ImageBitmap | null = null;
      void loadManualSourceBitmap(props.sourceUrl)
        .then(function drawManualSourceFx(loaded) {
          if (!active) {
            loaded.close();
            return;
          }
          bitmap = loaded;
          const context = canvas.getContext("2d");
          if (context === null) return;
          context.drawImage(loaded, 0, 0, props.width, props.height);
          const imageData = context.getImageData(0, 0, props.width, props.height);
          imageDataRef.current = imageData;
          repaint();
        })
        .catch(() => undefined);
      return function clearManualSourceFx() {
        active = false;
        bitmap?.close();
        imageDataRef.current = null;
      };
    },
    [engine, props.height, props.sourceUrl, props.width, repaint],
  );

  useEffect(
    function guardDirtyDraftNavigationFx() {
      return installManualDraftUnloadGuard(() => engine?.dirty ?? false);
    },
    [engine],
  );

  useEffect(
    function routeManualShortcutsFx() {
      function keyDownFx(event: KeyboardEvent): void {
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key.toLowerCase() !== "z" && event.key.toLowerCase() !== "y") return;
        event.preventDefault();
        if (event.key.toLowerCase() === "y" || event.shiftKey) redo();
        else undo();
      }
      globalThis.addEventListener("keydown", keyDownFx);
      return function removeManualShortcutsFx() {
        globalThis.removeEventListener("keydown", keyDownFx);
      };
    },
    [redo, undo],
  );

  if (engine === null) return null;

  return (
    <section
      className="border-border bg-card/70 rounded-xl border p-4 sm:p-5"
      aria-label={m.editorV2ManualWorkspace()}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography variant="heading-2" as="h2">
            {m.editorV2ManualTitle()}
          </Typography>
          <Typography variant="caption" as="p" className="text-muted-foreground mt-1">
            {m.editorV2ManualHint()}
          </Typography>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={m.editorV2ManualMode()}
        >
          <Button
            variant={mode === "restore" ? "default" : "outline"}
            size="sm"
            onClick={() => changeMode("restore")}
          >
            {m.editorV2Restore()}
          </Button>
          <Button
            variant={mode === "erase" ? "default" : "outline"}
            size="sm"
            onClick={() => changeMode("erase")}
          >
            {m.editorV2Erase()}
          </Button>
        </div>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-muted-foreground font-mono text-xs">
          {m.editorV2BrushSize()}: {brushSize}
          <input
            className="accent-primary mt-2 block w-full"
            type="range"
            min="8"
            max="180"
            value={brushSize}
            onChange={(event) => changeBrushSize(Number(event.currentTarget.value))}
          />
        </label>
        <div className="flex gap-2" aria-label={m.editorV2ViewportControls()}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => changeZoom((value) => Math.max(0.5, value - 0.25))}
          >
            −
          </Button>
          <Button variant="outline" size="sm" onClick={() => changeZoom(() => 1)}>
            {m.editorV2Fit()}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => changeZoom((value) => Math.min(3, value + 0.25))}
          >
            +
          </Button>
        </div>
      </div>
      <div className="border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,var(--card)_0_50%)] bg-[length:18px_18px] relative max-h-[65vh] overflow-auto rounded-lg border p-3">
        <div
          className="relative mx-auto origin-top-left"
          style={{ width: `${zoom * 100}%` }}
        >
          <canvas
            role="img"
            ref={canvasRef}
            width={props.width}
            height={props.height}
            className="block h-auto w-full touch-none select-none"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerCancel}
            onPointerLeave={() => setCursor(null)}
            aria-label={m.editorV2ManualCanvas()}
          />
          {cursor !== null ? (
            <span
              className="border-foreground pointer-events-none absolute rounded-full border"
              style={{
                width: `${(brushSize / props.width) * 100}%`,
                aspectRatio: "1",
                left: `${(cursor.x / props.width) * 100}%`,
                top: `${(cursor.y / props.height) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" onClick={undo} disabled={!engine.canUndo}>
            {m.editorV2DraftUndo()}
          </Button>
          <Button variant="outline" onClick={redo} disabled={!engine.canRedo}>
            {m.editorV2DraftRedo()}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => props.session.cancelManual()}>
            {m.editorV2Cancel()}
          </Button>
          <Button onClick={() => props.session.applyManual()} disabled={!engine.dirty}>
            {m.editorV2Apply()}
          </Button>
        </div>
      </div>
      <Typography variant="caption" as="p" role="status" className="sr-only">
        {engine.dirty ? m.editorV2ManualDirty() : m.editorV2ManualClean()}
      </Typography>
    </section>
  );
}
