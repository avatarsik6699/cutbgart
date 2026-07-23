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
      className="relative max-w-full overflow-hidden rounded-xl border bg-[conic-gradient(#e2e8f0_25%,#fff_0_50%,#e2e8f0_0_75%,#fff_0)] [background-size:20px_20px] dark:bg-[conic-gradient(#334155_25%,#0f172a_0_50%,#334155_0_75%,#0f172a_0)]"
      style={{
        aspectRatio: `${String(width)} / ${String(height)}`,
        width: `min(100%, calc(60vh * ${String(ratio)}), 40rem)`,
      }}
      data-testid={testId}
      data-source-width={width}
      data-source-height={height}
    >
      {children}
    </div>
  );
}
