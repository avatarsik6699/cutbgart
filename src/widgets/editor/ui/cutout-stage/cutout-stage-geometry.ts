import { EDITOR_IMAGE_VIEWPORT_CLASS_NAME, editorImageViewportStyle } from "@/shared/ui";

export const CUTOUT_STAGE_VIEWPORT_CLASS_NAME =
  "focus-visible:ring-ring relative grid size-full min-h-0 min-w-0 place-items-center overflow-hidden rounded-xl [container-type:size] transition-shadow duration-200 focus-visible:ring-2 data-[workspace-active=true]:ring-2 data-[workspace-active=true]:ring-primary/45 motion-reduce:transition-none";

export const CUTOUT_STAGE_CONTENT_CLASS_NAME = `${EDITOR_IMAGE_VIEWPORT_CLASS_NAME} rounded-xl bg-[repeating-conic-gradient(var(--muted)_0_25%,var(--card)_0_50%)] bg-[length:18px_18px]`;

export function isEditableCanvasShortcutTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]") !== null
  );
}

export const cutoutStageContentStyle = editorImageViewportStyle;
