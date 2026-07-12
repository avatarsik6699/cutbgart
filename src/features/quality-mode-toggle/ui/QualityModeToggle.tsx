import type { QualityMode } from "../../../entities/processed-image";
import { Gauge } from "lucide-react";
import { m } from "@/paraglide/messages";
import { Switch } from "../../../shared/ui";

export interface QualityModeToggleProps {
  qualityMode: QualityMode;
  onQualityModeChange: (mode: QualityMode) => void;
}

export function QualityModeToggle({
  qualityMode,
  onQualityModeChange,
}: QualityModeToggleProps) {
  const isMaxQuality = qualityMode === "max";

  return (
    <label className="inline-flex items-center gap-3 rounded-full border bg-background/80 px-4 py-2 text-sm shadow-sm backdrop-blur">
      <Gauge className="size-4 text-primary" aria-hidden="true" />
      <span className="font-medium">{m.qualityModeLabel()}</span>
      <Switch
        checked={isMaxQuality}
        onCheckedChange={(checked) => {
          onQualityModeChange(checked ? "max" : "fast");
        }}
      />
      <span className="text-muted-foreground">
        {isMaxQuality ? m.qualityMax() : m.qualityFast()}
      </span>
    </label>
  );
}
