import { DiagnosticsDesktopSheet } from "./components/diagnostics-desktop-sheet";
import { DiagnosticsMobileDrawer } from "./components/diagnostics-mobile-drawer";
import type { DiagnosticsSheetProps } from "./diagnostics.types";

export function DiagnosticsSheet(props: DiagnosticsSheetProps) {
  return (
    <>
      <DiagnosticsDesktopSheet {...props} />
      <DiagnosticsMobileDrawer {...props} />
    </>
  );
}
