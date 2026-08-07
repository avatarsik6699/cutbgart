import { Gauge } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Typography } from "@/shared/ui";

import { QualityModeOption } from "./components/quality-mode-option";
import { QUALITY_MODE_OPTIONS } from "./quality-mode-selector.config";
import type { QualityModeSelectorTypes } from "./quality-mode-selector.types";

export function QualityModeToggle(props: QualityModeSelectorTypes.Props) {
  return (
    <fieldset
      className="w-full space-y-2 [container-type:inline-size]"
      data-testid="processing-mode-selector"
    >
      <legend className="flex items-center gap-2">
        <Gauge className="size-4 text-primary" aria-hidden="true" />
        <Typography variant="body-small" as="span" className="font-semibold">
          {m.processingModeLabel()}
        </Typography>
      </legend>
      <div className="flex flex-col gap-2 @[28rem]:grid @[28rem]:grid-cols-3">
        {QUALITY_MODE_OPTIONS.map((option) => (
          <QualityModeOption
            key={option.id}
            disabled={props.disabled ?? false}
            onSelect={props.onQualityModeChange}
            option={option}
            selected={props.qualityMode === option.id}
          />
        ))}
      </div>
    </fieldset>
  );
}
