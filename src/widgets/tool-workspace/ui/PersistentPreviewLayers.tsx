import type { ReactNode } from "react";

export interface PersistentPreviewLayersProps {
  activeLayer: "comparison" | "magic" | "manual";
  comparison: ReactNode;
  magic?: ReactNode;
  manual?: ReactNode;
}

export function PersistentPreviewLayers({
  activeLayer,
  comparison,
  magic,
  manual,
}: PersistentPreviewLayersProps) {
  return (
    <div
      className="relative size-full"
      data-testid="persistent-preview-stack"
      data-active-layer={activeLayer}
    >
      {(
        [
          ["comparison", comparison],
          ["magic", magic],
          ["manual", manual],
        ] as const
      ).map(([name, layer]) =>
        layer ? (
          <div
            key={name}
            className="persistent-preview-layer absolute inset-0 grid size-full place-items-center"
            data-preview-layer={name}
            data-active={activeLayer === name}
            aria-hidden={activeLayer !== name}
          >
            {layer}
          </div>
        ) : null,
      )}
    </div>
  );
}
