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
import { useEffect, useEffectEvent } from "react";

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
  shortcutsActive: boolean;
}>;

type CanvasViewShortcut =
  "brush" | "fit" | "fullscreen" | "hand" | "zoom-in" | "zoom-out";

const MODIFIED_SHORTCUTS: Readonly<Record<string, CanvasViewShortcut>> = {
  "+": "zoom-in",
  "=": "zoom-in",
  add: "zoom-in",
  "-": "zoom-out",
  _: "zoom-out",
  subtract: "zoom-out",
  "0": "fit",
};

const PLAIN_SHORTCUTS: Readonly<Record<string, CanvasViewShortcut>> = {
  b: "brush",
  f: "fullscreen",
  h: "hand",
};

function canvasViewShortcut(
  event: KeyboardEvent,
  active: boolean,
  canPan: boolean,
): CanvasViewShortcut | null {
  const target = event.target;
  const editable =
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]") !== null;
  if (editable || !active || event.altKey) return null;
  const key = event.key.toLowerCase();
  const shortcut =
    event.ctrlKey || event.metaKey ? MODIFIED_SHORTCUTS[key] : PLAIN_SHORTCUTS[key];
  if (shortcut === "hand" && !canPan) return null;
  return shortcut ?? null;
}

export function CanvasViewControls(props: CanvasViewControlsProps) {
  const handleShortcutFx = useEffectEvent(function handleCanvasViewShortcutFx(
    event: KeyboardEvent,
  ): void {
    const shortcut = canvasViewShortcut(event, props.shortcutsActive, props.canPan);
    if (shortcut === null) return;
    event.preventDefault();
    switch (shortcut) {
      case "brush":
        props.onInteractionModeChange("brush");
        break;
      case "fit":
        props.onResetView();
        break;
      case "fullscreen":
        props.onToggleFullscreen();
        break;
      case "hand":
        props.onInteractionModeChange("hand");
        break;
      case "zoom-in":
        props.onZoomIn();
        break;
      case "zoom-out":
        props.onZoomOut();
        break;
    }
  });

  useEffect(function routeCanvasViewShortcutsFx() {
    globalThis.addEventListener("keydown", handleShortcutFx);
    return function removeCanvasViewShortcutsFx() {
      globalThis.removeEventListener("keydown", handleShortcutFx);
    };
  }, []);

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

  let interactionShortcut = "H";
  if (props.interactionMode === "hand") interactionShortcut = "B";
  else if (props.canPan) interactionShortcut = "H · Space + drag";

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
        shortcut={interactionShortcut}
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
