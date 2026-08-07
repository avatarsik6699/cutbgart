import { useState } from "react";
import { CircleMinus, CirclePlus } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Button, Typography } from "@/shared/ui";

import { ToolPanelSlot } from "../editor-tools";
import { CutoutModeTabs } from "../editor-tools/cutout-mode-tabs";
import type { ManualCutoutInteraction } from "./manual-cutout-workspace";

export function ManualCutoutPanel(
  props: Readonly<{
    interaction: ManualCutoutInteraction;
    onBrushSizeChange(brushSize: number): void;
    onCutoutModeChange?(mode: "magic" | "manual"): void;
  }>,
) {
  const initialView = props.interaction.readViewState();
  const [mode, setMode] = useState(initialView.mode);
  const draftState = props.interaction.snapshot();
  if (draftState === null) return null;

  function changeMode(nextMode: typeof mode): void {
    setMode(nextMode);
    props.interaction.writeViewState({
      ...props.interaction.readViewState(),
      mode: nextMode,
    });
  }

  return (
    <div className="[grid-area:rail]">
      <ToolPanelSlot toolId="cutout" label={m.editorManualWorkspace()} autoFocus>
        <section className="flex h-full min-h-0 flex-col gap-5">
          <CutoutModeTabs
            mode="manual"
            onModeChange={(mode) => props.onCutoutModeChange?.(mode)}
          />
          <div
            className="grid grid-cols-2 gap-2"
            role="toolbar"
            aria-label={m.editorManualMode()}
          >
            <Button
              variant={mode === "restore" ? "default" : "outline"}
              className={`h-20 flex-col gap-1.5 ${mode === "restore" ? "bg-emerald-700 text-white hover:bg-emerald-800" : "border-emerald-700 text-emerald-800 dark:text-emerald-300"}`}
              onClick={() => changeMode("restore")}
            >
              <CirclePlus className="size-6" aria-hidden="true" />
              {m.editorRestore()}
            </Button>
            <Button
              variant={mode === "erase" ? "default" : "outline"}
              className={`h-20 flex-col gap-1.5 ${mode === "erase" ? "bg-rose-700 text-white hover:bg-rose-800" : "border-rose-700 text-rose-800 dark:text-rose-300"}`}
              onClick={() => changeMode("erase")}
            >
              <CircleMinus className="size-6" aria-hidden="true" />
              {m.editorErase()}
            </Button>
          </div>
          <Typography
            variant="caption"
            as="p"
            className="min-h-10 leading-4 text-muted-foreground"
          >
            {m.editorManualHint()}
          </Typography>
          <label className="grid max-w-md gap-2 text-sm font-medium">
            <span>{m.brushSize()}</span>
            <input
              type="range"
              min="8"
              max="180"
              defaultValue={initialView.brushSize}
              onChange={(event) =>
                props.onBrushSizeChange(Number(event.currentTarget.value))
              }
            />
          </label>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <Button
              className="w-full"
              onClick={props.interaction.apply}
              disabled={!draftState.dirty}
            >
              {m.cutoutApply()}
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={props.interaction.cancel}
            >
              {m.cancel()}
            </Button>
          </div>
          <Typography variant="caption" as="p" role="status" className="sr-only">
            {draftState.dirty ? m.editorManualDirty() : m.editorManualClean()}
          </Typography>
        </section>
      </ToolPanelSlot>
    </div>
  );
}
