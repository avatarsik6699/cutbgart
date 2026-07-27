import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Redo2, Undo2 } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import type { EditorToolDefinition, EditorToolId } from "../model/editor-tool-registry";

export interface EditorToolbarProps {
  tools: readonly EditorToolDefinition[];
  activeTool: EditorToolId;
  onToolChange: (tool: EditorToolId, trigger: HTMLButtonElement) => void;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string | null;
  redoLabel?: string | null;
  onUndo: () => void;
  onRedo: () => void;
  downloadSlot?: ReactNode;
}

export function EditorToolbar({
  tools,
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  onUndo,
  onRedo,
  downloadSlot,
}: EditorToolbarProps) {
  const toolRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
    <div
      role="toolbar"
      aria-label={m.editorToolbarLabel()}
      aria-orientation="horizontal"
      onKeyDown={handleNavigation}
      className="editor-toolbar flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border bg-card p-2 shadow-sm"
      data-testid="editor-toolbar"
    >
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
      {downloadSlot && (
        <>
          <span className="mx-1 h-7 w-px shrink-0 bg-border" aria-hidden="true" />
          <div className="ml-auto shrink-0" data-testid="editor-download-slot">
            {downloadSlot}
          </div>
        </>
      )}
      <p className="sr-only" aria-live="polite" data-testid="active-tool-announcement">
        {m.editorActiveTool({
          tool: tools.find(({ id }) => id === activeTool)?.label ?? "",
        })}
      </p>
    </div>
  );
}
