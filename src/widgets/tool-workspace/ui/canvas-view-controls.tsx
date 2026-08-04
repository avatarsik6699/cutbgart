import {
  Brush,
  Hand,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Scan,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect } from "react";

import { m } from "@/paraglide/messages";
import { CanvasViewIconButton } from "./canvas-view-icon-button";

export type CanvasInteractionMode = "brush" | "hand";

export type CanvasViewControlsProps = Readonly<{
  interactionMode: CanvasInteractionMode;
  onInteractionModeChange: (mode: CanvasInteractionMode) => void;
  zoomPercent: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  canPan: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  expanded: boolean;
  onToggleFullscreen: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}>;

export function CanvasViewControls(props: CanvasViewControlsProps) {
  const canPan = props.canPan;
  const onInteractionModeChange = props.onInteractionModeChange;
  const onToggleFullscreen = props.onToggleFullscreen;
  useEffect(
    function routeCanvasViewShortcutsFx() {
      function handleShortcutFx(event: KeyboardEvent): void {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("input, textarea, select, [contenteditable]")
        )
          return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const key = event.key.toLowerCase();
        if (key === "h" && canPan) {
          event.preventDefault();
          onInteractionModeChange("hand");
        } else if (key === "b") {
          event.preventDefault();
          onInteractionModeChange("brush");
        } else if (key === "f") {
          event.preventDefault();
          onToggleFullscreen();
        }
      }
      globalThis.addEventListener("keydown", handleShortcutFx);
      return function removeCanvasViewShortcutsFx() {
        globalThis.removeEventListener("keydown", handleShortcutFx);
      };
    },
    [canPan, onInteractionModeChange, onToggleFullscreen],
  );

  if (props.collapsed) {
    return (
      <div
        className="absolute bottom-3 right-3 z-30 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur"
        data-testid="canvas-view-controls"
        data-collapsed="true"
      >
        <CanvasViewIconButton
          label={m.expandViewControls()}
          onClick={() => props.onCollapsedChange(false)}
        >
          <SlidersHorizontal aria-hidden="true" />
        </CanvasViewIconButton>
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label={m.viewControls()}
      className="absolute bottom-3 right-3 z-30 flex items-center gap-0.5 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur"
      data-testid="canvas-view-controls"
      data-collapsed="false"
    >
      <CanvasViewIconButton
        label={props.interactionMode === "hand" ? m.brushTool() : m.handTool()}
        shortcut={
          props.interactionMode === "hand" ? "B" : props.canPan ? "H · Space + drag" : "H"
        }
        pressed={props.interactionMode === "hand"}
        disabled={!props.canPan && props.interactionMode !== "hand"}
        onClick={() =>
          props.onInteractionModeChange(
            props.interactionMode === "hand" ? "brush" : "hand",
          )
        }
      >
        {props.interactionMode === "hand" ? (
          <Brush aria-hidden="true" />
        ) : (
          <Hand aria-hidden="true" />
        )}
      </CanvasViewIconButton>
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
      <CanvasViewIconButton
        label={m.zoomOut()}
        shortcut="Ctrl/⌘ −"
        disabled={!props.canZoomOut}
        onClick={props.onZoomOut}
      >
        <ZoomOut aria-hidden="true" />
      </CanvasViewIconButton>
      <span
        className="min-w-12 px-1 text-center font-mono text-xs tabular-nums"
        aria-label={`Zoom ${String(props.zoomPercent)}%`}
      >
        {props.zoomPercent}%
      </span>
      <CanvasViewIconButton
        label={m.zoomIn()}
        shortcut="Ctrl/⌘ +"
        disabled={!props.canZoomIn}
        onClick={props.onZoomIn}
      >
        <ZoomIn aria-hidden="true" />
      </CanvasViewIconButton>
      <CanvasViewIconButton
        label={m.fitView()}
        shortcut="Ctrl/⌘ 0"
        onClick={props.onResetView}
      >
        <Scan aria-hidden="true" />
      </CanvasViewIconButton>
      <CanvasViewIconButton
        label={props.expanded ? m.exitFullscreen() : m.enterFullscreen()}
        shortcut={props.expanded ? "Esc" : "F"}
        pressed={props.expanded}
        onClick={props.onToggleFullscreen}
      >
        {props.expanded ? (
          <Minimize2 aria-hidden="true" />
        ) : (
          <Maximize2 aria-hidden="true" />
        )}
      </CanvasViewIconButton>
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
      <CanvasViewIconButton
        label={m.collapseViewControls()}
        onClick={() => props.onCollapsedChange(true)}
      >
        <MoreHorizontal aria-hidden="true" />
      </CanvasViewIconButton>
    </div>
  );
}
