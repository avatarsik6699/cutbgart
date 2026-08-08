import type { LucideIcon } from "lucide-react";

import type { AutomaticModelMode } from "@/shared/lib";

export declare namespace QualityModeSelectorTypes {
  type Props = Readonly<{
    disabled?: boolean;
    onQualityModeChange: (mode: AutomaticModelMode) => void;
    qualityMode: AutomaticModelMode | null;
  }>;

  type Option = Readonly<{
    emphasized: boolean;
    hint: () => string;
    icon: LucideIcon;
    id: AutomaticModelMode;
    label: () => string;
    meta: () => string;
  }>;
}
