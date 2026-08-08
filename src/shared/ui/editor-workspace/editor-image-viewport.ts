import type { CSSProperties } from "react";

export const EDITOR_IMAGE_VIEWPORT_CLASS_NAME = "editor-image-frame relative shrink-0";

export function editorImageViewportStyle(width: number, height: number): CSSProperties {
  const ratio = width / height;
  return {
    aspectRatio: `${String(width)} / ${String(height)}`,
    width: `min(100cqw, ${String(ratio * 100)}cqh)`,
    height: `min(100cqh, ${String((1 / ratio) * 100)}cqw)`,
    transformOrigin: "center",
  };
}
