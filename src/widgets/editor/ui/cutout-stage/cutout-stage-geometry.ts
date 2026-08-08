import { EDITOR_IMAGE_VIEWPORT_CLASS_NAME, editorImageViewportStyle } from "@/shared/ui";

export const CUTOUT_STAGE_VIEWPORT_CLASS_NAME =
  "focus-visible:ring-ring relative grid size-full min-h-0 min-w-0 place-items-center overflow-hidden rounded-xl [container-type:size] transition-shadow duration-200 focus-visible:ring-2 data-[workspace-active=true]:ring-2 data-[workspace-active=true]:ring-primary/45 motion-reduce:transition-none";

export const CUTOUT_STAGE_CONTENT_CLASS_NAME = `${EDITOR_IMAGE_VIEWPORT_CLASS_NAME} transparency-grid rounded-xl`;

/** Brush cursor palette shared by Magic ("keep" | "remove") and Manual
 * ("restore" | "erase") cutout: green marks the kept/restored region, red
 * marks the erased/removed region, matching remove.bg's solid
 * semi-transparent brush indicator. */
export const CUTOUT_BRUSH_CURSOR_FILL_COLOR: Record<
  "erase" | "keep" | "remove" | "restore",
  string
> = {
  keep: "rgba(34, 197, 94, 0.42)",
  restore: "rgba(34, 197, 94, 0.42)",
  remove: "rgba(239, 68, 68, 0.42)",
  erase: "rgba(239, 68, 68, 0.42)",
};

export function isEditableCanvasShortcutTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]") !== null
  );
}

export const cutoutStageContentStyle = editorImageViewportStyle;
