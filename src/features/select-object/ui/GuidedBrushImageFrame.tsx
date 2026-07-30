import type { ReactNode, Ref } from "react";

interface Props {
  width: number;
  height: number;
  frameRef?: Ref<HTMLDivElement>;
  testId: string;
  children: ReactNode;
}

export function GuidedBrushImageFrame({
  width,
  height,
  frameRef,
  testId,
  children,
}: Props) {
  const ratio = width / height;

  return (
    <div
      ref={frameRef}
      className="transparency-grid editor-image-frame relative overflow-hidden rounded-xl"
      style={{
        aspectRatio: `${String(width)} / ${String(height)}`,
        width: `min(100cqw, calc(100cqh * ${String(ratio)}))`,
        height: `min(100cqh, calc(100cqw / ${String(ratio)}))`,
      }}
      data-testid={testId}
      data-fit="contain"
      data-source-width={width}
      data-source-height={height}
    >
      {children}
    </div>
  );
}
