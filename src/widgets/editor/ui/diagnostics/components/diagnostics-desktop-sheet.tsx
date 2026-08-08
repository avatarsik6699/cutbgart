import { m } from "@/paraglide/messages";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui";

import { DiagnosticsContent } from "./diagnostics-content";
import { DiagnosticsTriggerButton } from "./diagnostics-trigger-button";
import type { DiagnosticsTypes } from "../diagnostics.types";

export function DiagnosticsDesktopSheet(props: DiagnosticsTypes.SheetProps) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <DiagnosticsTriggerButton
            testId="diagnostics-trigger-desktop"
            className="hidden min-[56rem]:inline-flex"
          />
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{m.diagnostics()}</SheetTitle>
          <SheetDescription>{m.diagnosticsDescription()}</SheetDescription>
        </SheetHeader>
        <DiagnosticsContent {...props} />
      </SheetContent>
    </Sheet>
  );
}
