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
import { useEffect, type ReactNode } from "react";

import { m } from "@/paraglide/messages";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui";

export type CanvasInteractionMode = "brush" | "hand";

interface CanvasViewControlsProps {
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
}

function IconButton({
  label,
  shortcut,
  disabled,
  pressed,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant={pressed ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => onClick()}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        <span>{label}</span>
        {shortcut && (
          <kbd className="ml-2 rounded border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[0.625rem]">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function CanvasViewControls({
  interactionMode,
  onInteractionModeChange,
  zoomPercent,
  canZoomIn,
  canZoomOut,
  canPan,
  onZoomIn,
  onZoomOut,
  onResetView,
  expanded,
  onToggleFullscreen,
  collapsed,
  onCollapsedChange,
}: CanvasViewControlsProps) {
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
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
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [canPan, onInteractionModeChange, onToggleFullscreen]);

  if (collapsed) {
    return (
      <div
        className="absolute bottom-3 right-3 z-30 rounded-xl border bg-card/95 p-1 shadow-lg backdrop-blur"
        data-testid="canvas-view-controls"
        data-collapsed="true"
      >
        <IconButton
          label={m.expandViewControls()}
          onClick={() => onCollapsedChange(false)}
        >
          <SlidersHorizontal aria-hidden="true" />
        </IconButton>
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label={m.viewControls()}
      className="absolute bottom-3 right-3 z-30 flex items-center gap-0.5 rounded-xl border bg-card/95 p-1 shadow-lg backdrop-blur"
      data-testid="canvas-view-controls"
      data-collapsed="false"
    >
      <IconButton
        label={interactionMode === "hand" ? m.brushTool() : m.handTool()}
        shortcut={interactionMode === "hand" ? "B" : canPan ? "H · Space + drag" : "H"}
        pressed={interactionMode === "hand"}
        disabled={!canPan && interactionMode !== "hand"}
        onClick={() =>
          onInteractionModeChange(interactionMode === "hand" ? "brush" : "hand")
        }
      >
        {interactionMode === "hand" ? (
          <Brush aria-hidden="true" />
        ) : (
          <Hand aria-hidden="true" />
        )}
      </IconButton>
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
      <IconButton
        label={m.zoomOut()}
        shortcut="Ctrl/⌘ −"
        disabled={!canZoomOut}
        onClick={onZoomOut}
      >
        <ZoomOut aria-hidden="true" />
      </IconButton>
      <span
        className="min-w-12 px-1 text-center text-xs tabular-nums"
        aria-label={`Zoom ${String(zoomPercent)}%`}
      >
        {zoomPercent}%
      </span>
      <IconButton
        label={m.zoomIn()}
        shortcut="Ctrl/⌘ +"
        disabled={!canZoomIn}
        onClick={onZoomIn}
      >
        <ZoomIn aria-hidden="true" />
      </IconButton>
      <IconButton label={m.fitView()} shortcut="Ctrl/⌘ 0" onClick={onResetView}>
        <Scan aria-hidden="true" />
      </IconButton>
      <IconButton
        label={expanded ? m.exitFullscreen() : m.enterFullscreen()}
        shortcut={expanded ? "Esc" : "F"}
        pressed={expanded}
        onClick={onToggleFullscreen}
      >
        {expanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
      </IconButton>
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
      <IconButton
        label={m.collapseViewControls()}
        onClick={() => onCollapsedChange(true)}
      >
        <MoreHorizontal aria-hidden="true" />
      </IconButton>
    </div>
  );
}
