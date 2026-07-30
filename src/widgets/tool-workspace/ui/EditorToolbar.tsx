import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowLeft, Redo2, Undo2 } from "lucide-react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui";
import type { EditorToolDefinition, EditorToolId } from "../model/editor-tool-registry";

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
  workspaceActionsSlot?: ReactNode;
  downloadSlot?: ReactNode;
  statusSlot?: ReactNode;
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
  workspaceActionsSlot,
  downloadSlot,
  statusSlot,
  onBack,
}: EditorToolbarProps) {
  const toolRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollFade, setScrollFade] = useState({ left: false, right: false });
  const hasStatusSlot = Boolean(statusSlot);
  const hasWorkspaceActionsSlot = Boolean(workspaceActionsSlot);
  const hasDownloadSlot = Boolean(downloadSlot);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () =>
      setScrollFade((prev) => {
        const next = {
          left: el.scrollLeft > 4,
          right: el.scrollWidth - el.scrollLeft - el.clientWidth > 4,
        };
        return prev.left === next.left && prev.right === next.right ? prev : next;
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [tools.length, hasStatusSlot, hasWorkspaceActionsSlot, hasDownloadSlot]);

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
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % buttons.length
            : (currentIndex - 1 + buttons.length) % buttons.length;
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
        className="editor-toolbar flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-card p-2"
        data-testid="editor-toolbar"
      >
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
          {statusSlot}
          {workspaceActionsSlot}
          {downloadSlot && <div data-testid="editor-download-slot">{downloadSlot}</div>}
        </div>
        <p className="sr-only" aria-live="polite" data-testid="active-tool-announcement">
          {activeTool
            ? m.editorActiveTool({
                tool: tools.find(({ id }) => id === activeTool)?.label ?? "",
              })
            : ""}
        </p>
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-lg bg-gradient-to-r from-card to-transparent transition-opacity duration-150",
          scrollFade.left ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-lg bg-gradient-to-l from-card to-transparent transition-opacity duration-150",
          scrollFade.right ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
