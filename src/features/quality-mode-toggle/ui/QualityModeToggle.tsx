import type { QualityMode } from "../../../entities/processed-image";
import { Card, CardContent, CardHeader, CardTitle, Switch } from "../../../shared/ui";

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
    <Card>
      <CardHeader>
        <CardTitle>Quality mode</CardTitle>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-3 text-sm">
          <Switch
            checked={isMaxQuality}
            onCheckedChange={(checked) => {
              onQualityModeChange(checked ? "max" : "fast");
            }}
          />
          {isMaxQuality ? "Max quality" : "Fast"}
        </label>
      </CardContent>
    </Card>
  );
}
