import { useEffect, useRef } from "react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import { Typography } from "@/v2/shared/ui";

import type { MainPageEditorPresentationProps } from "./main-page-editor-contract";

type Props = Pick<MainPageEditorPresentationProps, "projection" | "onIntent">;

export function MainPageResultRail(props: Props) {
  const manualRef = useRef<HTMLButtonElement>(null);
  const magicRef = useRef<HTMLButtonElement>(null);
  const backgroundRef = useRef<HTMLButtonElement>(null);
  const enhancementsRef = useRef<HTMLButtonElement>(null);
  const restoreFocusTool = props.projection.restoreFocusTool;
  const onIntent = props.onIntent;

  useEffect(
    function routeDocumentHistoryShortcutsFx() {
      function keyDownFx(event: KeyboardEvent): void {
        if (!(event.ctrlKey || event.metaKey)) return;
        const key = event.key.toLowerCase();
        if (key !== "z" && key !== "y") return;
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          target.matches('input, textarea, [contenteditable="true"]')
        )
          return;
        event.preventDefault();
        if (key === "y" || event.shiftKey) {
          if (props.projection.canRedoDocument) onIntent({ type: "redo-document" });
          return;
        }
        if (props.projection.canUndoDocument) onIntent({ type: "undo-document" });
      }
      globalThis.addEventListener("keydown", keyDownFx);
      return function removeDocumentHistoryShortcutsFx() {
        globalThis.removeEventListener("keydown", keyDownFx);
      };
    },
    [onIntent, props.projection.canRedoDocument, props.projection.canUndoDocument],
  );

  useEffect(
    function restoreToolLauncherFocusFx() {
      const tool = restoreFocusTool;
      if (tool === null) return;
      let target = enhancementsRef.current;
      if (tool === "manual") target = manualRef.current;
      else if (tool === "magic") target = magicRef.current;
      else if (tool === "background") target = backgroundRef.current;
      target?.focus();
      onIntent({ type: "focus-restored" });
    },
    [onIntent, restoreFocusTool],
  );

  return (
    <section
      className="border-border bg-card/60 rounded-xl border p-4 sm:p-5"
      aria-live="polite"
    >
      <Typography
        variant="label"
        as="h2"
        className="text-muted-foreground uppercase tracking-[0.16em]"
      >
        {m.editorV2StateHeading()}
      </Typography>
      <Typography variant="body-small" as="p" className="mt-2">
        {m.editorV2Privacy()}
      </Typography>
      <Typography
        variant="caption"
        as="p"
        className="text-muted-foreground mt-1 font-mono"
      >
        {m.editorV2Revision({ revision: String(props.projection.revision) })}
      </Typography>
      <Typography variant="caption" as="p" className="text-muted-foreground mt-2">
        {m.editorV2Shortcuts()}
      </Typography>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          ref={manualRef}
          variant="outline"
          onClick={() => props.onIntent({ type: "begin-manual" })}
        >
          {m.editorV2ManualTitle()}
        </Button>
        <Button
          ref={magicRef}
          variant="outline"
          onClick={() => props.onIntent({ type: "begin-magic" })}
        >
          {m.editorV2MagicTitle()}
        </Button>
        <Button
          variant="outline"
          ref={backgroundRef}
          onClick={() => props.onIntent({ type: "begin-background" })}
        >
          {m.editorV2BackgroundTitle()}
        </Button>
        <Button
          variant="outline"
          ref={enhancementsRef}
          onClick={() => props.onIntent({ type: "begin-enhancements" })}
        >
          {m.editorV2EnhancementsTitle()}
        </Button>
        <Button
          variant="outline"
          disabled={!props.projection.canUndoDocument}
          onClick={() => props.onIntent({ type: "undo-document" })}
        >
          {m.editorV2DocumentUndo()}
        </Button>
        <Button
          variant="outline"
          disabled={!props.projection.canRedoDocument}
          onClick={() => props.onIntent({ type: "redo-document" })}
        >
          {m.editorV2DocumentRedo()}
        </Button>
      </div>
    </section>
  );
}
