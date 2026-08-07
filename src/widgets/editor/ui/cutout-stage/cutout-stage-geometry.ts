import type { CSSProperties } from "react";

export const CUTOUT_STAGE_VIEWPORT_CLASS_NAME =
  "border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,var(--card)_0_50%)] bg-[length:18px_18px] focus-visible:ring-ring relative grid size-full min-h-0 min-w-0 place-items-center overflow-hidden rounded-lg border [container-type:size] focus-visible:ring-2";

export function isEditableCanvasShortcutTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]") !== null
  );
}

export function cutoutStageContentStyle(width: number, height: number): CSSProperties {
  const ratio = width / height;
  return {
    width: `min(100cqw, ${String(ratio * 100)}cqh)`,
    height: `min(100cqh, ${String((1 / ratio) * 100)}cqw)`,
    transformOrigin: "center",
  };
}
