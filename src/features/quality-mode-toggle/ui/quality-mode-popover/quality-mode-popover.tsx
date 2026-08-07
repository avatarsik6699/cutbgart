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
  Typography,
} from "@/shared/ui";

import {
  QualityModeToggle,
  type QualityModeSelectorTypes,
} from "../quality-mode-selector";
import { selectedModeLabel } from "./quality-mode-popover.utils";

export function QualityModePopover(props: QualityModeSelectorTypes.Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" className="max-w-52 gap-2" />}
      >
        <Gauge aria-hidden="true" />
        <Typography variant="body-small" as="span" className="truncate">
          {selectedModeLabel(props.qualityMode)}
        </Typography>
      </PopoverTrigger>
      <PopoverContent className="w-[min(46rem,calc(100vw-2rem))]">
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
