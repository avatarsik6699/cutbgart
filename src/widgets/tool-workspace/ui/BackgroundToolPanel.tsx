import type { BackgroundFill, ProcessedImage } from "../../../entities/processed-image";
import { BackgroundFillSelector } from "../../../features/background-replacement";

export interface BackgroundToolPanelProps {
  image: Pick<ProcessedImage, "source" | "backgroundFill">;
  onPreview: (fill: BackgroundFill) => void;
  onApply: (fill: BackgroundFill) => Promise<ProcessedImage>;
  onResult: (image: ProcessedImage) => void;
  onBusyChange?: (busy: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function BackgroundToolPanel(props: BackgroundToolPanelProps) {
  return (
    <div data-testid="background-tool-panel">
      <BackgroundFillSelector {...props} />
    </div>
  );
}
