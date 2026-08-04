import { createPortal } from "react-dom";

import { useHeaderUtilityPortalTarget } from "@/shared/ui";
import { DiagnosticsSheet } from "@/widgets/tool-workspace";

export function MainPageDiagnosticsPortal() {
  const target = useHeaderUtilityPortalTarget();
  return target === null ? null : createPortal(<DiagnosticsSheet logs={[]} />, target);
}
