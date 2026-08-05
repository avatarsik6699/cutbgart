import { createPortal } from "react-dom";

import { useHeaderUtilityPortalTarget } from "@/shared/ui";
import { DiagnosticsSheet } from "@/v2/presentation/shared";

export function MainPageDiagnosticsPortal() {
  const target = useHeaderUtilityPortalTarget();
  return target === null ? null : createPortal(<DiagnosticsSheet logs={[]} />, target);
}
