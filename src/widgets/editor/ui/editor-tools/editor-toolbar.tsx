import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, Redo2, Undo2 } from "lucide-react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui";
import type { EditorToolId } from "./editor-tool-workspace-contract";
import type { EditorToolDefinition } from "./editor-tool-registry";

export interface EditorToolbarProps {
  tools?: readonly EditorToolDefinition[];
  activeTool?: EditorToolId | null;
  onToolChange?: (tool: EditorToolId, trigger: HTMLButtonElement) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  undoLabel?: string | null;
  redoLabel?: string | null;
  onUndo?: () => void;
  onRedo?: () => void;
  WorkspaceActionsSlot?: ReactNode;
  DownloadSlot?: ReactNode;
  StatusSlot?: ReactNode;
  onBack?: (trigger: HTMLButtonElement) => void;
}

export function EditorToolbar({
  tools = [],
  activeTool = null,
  onToolChange,
  canUndo = false,
  canRedo = false,
  undoLabel,
  redoLabel,
  onUndo = () => undefined,
  onRedo = () => undefined,
  WorkspaceActionsSlot,
  DownloadSlot,
  StatusSlot,
  onBack,
}: EditorToolbarProps) {
  const toolRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const leftBoundaryRef = useRef<HTMLSpanElement | null>(null);
  const rightBoundaryRef = useRef<HTMLSpanElement | null>(null);
  const [scrollFade, setScrollFade] = useState({ left: false, right: false });
  const hasStatusSlot = Boolean(StatusSlot);
  const hasWorkspaceActionsSlot = Boolean(WorkspaceActionsSlot);
  const hasDownloadSlot = Boolean(DownloadSlot);

  useEffect(
    function observeScrollBoundariesFx() {
      const scrollElement = scrollRef.current;
      const leftBoundary = leftBoundaryRef.current;
      const rightBoundary = rightBoundaryRef.current;
      if (
        !scrollElement ||
        !leftBoundary ||
        !rightBoundary ||
        !window.IntersectionObserver
      ) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          setScrollFade((previous) => {
            let left = previous.left;
            let right = previous.right;

            for (const entry of entries) {
              if (entry.target === leftBoundary) left = !entry.isIntersecting;
              if (entry.target === rightBoundary) right = !entry.isIntersecting;
            }

            return previous.left === left && previous.right === right
              ? previous
              : { left, right };
          });
        },
        { root: scrollElement, rootMargin: "0px -4px", threshold: 1 },
      );
      observer.observe(leftBoundary);
      observer.observe(rightBoundary);

      return () => {
        observer.disconnect();
      };
    },
    [tools.length, hasStatusSlot, hasWorkspaceActionsSlot, hasDownloadSlot],
  );

  function handleNavigation(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = toolRefs.current.filter((button): button is HTMLButtonElement =>
      Boolean(button),
    );
    if (!buttons.length) return;
    const currentIndex = Math.max(
      0,
      buttons.indexOf(document.activeElement as HTMLButtonElement),
    );
    let nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = buttons.length - 1;
    else if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % buttons.length;
    event.preventDefault();
    buttons[nextIndex]?.focus();
  }

  return (
    <div className="relative w-full">
      <div
        ref={scrollRef}
        role="toolbar"
        aria-label={m.editorToolbarLabel()}
        aria-orientation="horizontal"
        onKeyDown={handleNavigation}
        className="editor-toolbar w-full max-w-full overflow-x-auto rounded-lg border border-border bg-card"
        data-testid="editor-toolbar"
      >
        <div className="relative flex min-w-full w-max items-center gap-1 p-2">
          <span
            ref={leftBoundaryRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-2 left-2 w-px"
            data-scroll-boundary="left"
          />
          {onBack && (
            <>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={m.workspaceBack()}
                      onClick={(event) => onBack(event.currentTarget)}
                    />
                  }
                >
                  <ArrowLeft aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>{m.workspaceBack()}</TooltipContent>
              </Tooltip>
              <span className="mx-1 h-7 w-px shrink-0 bg-border" aria-hidden="true" />
            </>
          )}
          {activeTool && onToolChange && (
            <div className="flex shrink-0 items-center gap-1">
              {tools.map((tool, index) => {
                const Icon = tool.icon;
                const selected = tool.id === activeTool;
                return (
                  <Button
                    key={tool.id}
                    ref={(node) => {
                      toolRefs.current[index] = node;
                    }}
                    type="button"
                    variant={selected ? "secondary" : "ghost"}
                    aria-pressed={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={(event) => onToolChange(tool.id, event.currentTarget)}
                    className="h-10 gap-2 px-3"
                    data-tool-id={tool.id}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span>{tool.label}</span>
                  </Button>
                );
              })}
            </div>
          )}
          {activeTool && (
            <>
              <span className="mx-1 h-7 w-px shrink-0 bg-border" aria-hidden="true" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label={undoLabel ?? m.editorUndo()}
                title={undoLabel ?? m.editorUndo()}
              >
                <Undo2 aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRedo}
                disabled={!canRedo}
                aria-label={redoLabel ?? m.editorRedo()}
                title={redoLabel ?? m.editorRedo()}
              >
                <Redo2 aria-hidden="true" />
              </Button>
            </>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {StatusSlot}
            {WorkspaceActionsSlot}
            {DownloadSlot && <div data-testid="editor-download-slot">{DownloadSlot}</div>}
          </div>
          <span
            ref={rightBoundaryRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-2 right-2 w-px"
            data-scroll-boundary="right"
          />
          <p
            className="sr-only"
            aria-live="polite"
            data-testid="active-tool-announcement"
          >
            {activeTool
              ? m.editorActiveTool({
                  tool: tools.find(({ id }) => id === activeTool)?.label ?? "",
                })
              : ""}
          </p>
        </div>
      </div>
      <div
        aria-hidden="true"
        data-scroll-fade="left"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-lg bg-gradient-to-r from-card to-transparent transition-opacity duration-150",
          scrollFade.left ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden="true"
        data-scroll-fade="right"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-lg bg-gradient-to-l from-card to-transparent transition-opacity duration-150",
          scrollFade.right ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
