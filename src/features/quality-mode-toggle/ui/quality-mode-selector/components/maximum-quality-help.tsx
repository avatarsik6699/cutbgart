import { CircleHelp } from "lucide-react";

import { m } from "@/paraglide/messages";
import { InteractivePopover } from "@/shared/ui";

export function MaximumQualityHelp() {
  return (
    <InteractivePopover
      ariaLabel={m.processingModeMaximumHelpLabel()}
      title={m.processingModeMaximumHelpTitle()}
      TriggerIcon={CircleHelp}
    >
      {m.processingModeMaximumHelpBody()}
    </InteractivePopover>
  );
}
