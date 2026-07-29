import { Gauge } from "lucide-react";
import { useState } from "react";

import { m } from "@/paraglide/messages";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/shared/ui";
import { QualityModeToggle, type QualityModeToggleProps } from "./QualityModeToggle";

function selectedModeLabel(mode: QualityModeToggleProps["qualityMode"]) {
  if (mode === "ben2-fp16") return m.processingModeBen2();
  if (mode === "isnet-fp32") return m.processingModePrecise();
  return m.processingModeFast();
}

export function QualityModePopover(props: QualityModeToggleProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" className="max-w-52 gap-2" />}
      >
        <Gauge aria-hidden="true" />
        <span className="truncate">{selectedModeLabel(props.qualityMode)}</span>
      </PopoverTrigger>
      <PopoverContent className="w-[min(42rem,calc(100vw-2rem))]">
        <PopoverHeader>
          <PopoverTitle>{m.processingModeLabel()}</PopoverTitle>
          <PopoverDescription className="sr-only">
            {m.processingModeOptimalHint()}
          </PopoverDescription>
        </PopoverHeader>
        <QualityModeToggle
          {...props}
          onQualityModeChange={(mode) => {
            props.onQualityModeChange(mode);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
