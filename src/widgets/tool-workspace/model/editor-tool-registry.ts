import type { ComponentType } from "react";
import { ImageIcon, Scissors, Sparkles } from "lucide-react";

import { m } from "@/paraglide/messages";

export type EditorToolId = "cutout" | "enhance" | "background";

export interface EditorToolIconProps {
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

export interface EditorToolDefinition {
  id: EditorToolId;
  label: string;
  icon: ComponentType<EditorToolIconProps>;
  order: number;
  loadPanel: () => Promise<unknown>;
}

const loadPanelSlot = () => import("../ui/ToolPanelSlot");

export function createEditorToolRegistry(): readonly EditorToolDefinition[] {
  const registry = [
    {
      id: "cutout",
      label: m.editorToolCutout(),
      icon: Scissors,
      order: 10,
      loadPanel: loadPanelSlot,
    },
    {
      id: "enhance",
      label: m.editorToolEnhance(),
      icon: Sparkles,
      order: 20,
      loadPanel: loadPanelSlot,
    },
    {
      id: "background",
      label: m.editorToolBackground(),
      icon: ImageIcon,
      order: 30,
      loadPanel: loadPanelSlot,
    },
  ] satisfies EditorToolDefinition[];
  return registry.sort((left, right) => left.order - right.order);
}
