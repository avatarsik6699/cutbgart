import { X } from "lucide-react";

import { m } from "@/paraglide/messages";
import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/ui";

import { DiagnosticsContent } from "./diagnostics-content";
import { DiagnosticsTriggerButton } from "./diagnostics-trigger-button";
import type { DiagnosticsSheetProps } from "../diagnostics.types";

export function DiagnosticsMobileDrawer(props: DiagnosticsSheetProps) {
  return (
    <Drawer>
      <DrawerTrigger
        render={
          <DiagnosticsTriggerButton
            testId="diagnostics-trigger-mobile"
            className="min-[56rem]:hidden"
          />
        }
      />
      <DrawerContent>
        <DrawerHeader className="relative pr-14">
          <DrawerTitle>{m.diagnostics()}</DrawerTitle>
          <DrawerDescription>{m.diagnosticsDescription()}</DrawerDescription>
          <DrawerClose
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-4 top-4"
                aria-label={m.close()}
              />
            }
          >
            <X aria-hidden="true" />
          </DrawerClose>
        </DrawerHeader>
        <DiagnosticsContent {...props} />
      </DrawerContent>
    </Drawer>
  );
}
