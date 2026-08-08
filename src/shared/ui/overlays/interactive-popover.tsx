import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { m } from "@/paraglide/messages";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";

type Props = Readonly<{
  ariaLabel: string;
  children: ReactNode;
  title: ReactNode;
  TriggerIcon: LucideIcon;
}>;

type OpenChangeReason = Parameters<
  NonNullable<PopoverPrimitive.Root.Props["onOpenChange"]>
>[1]["reason"];

function shouldCancelClose(
  reason: OpenChangeReason,
  pressOpen: boolean,
  wasPressOpenBeforeInteraction: boolean,
): boolean {
  const freshPressClose =
    reason === "trigger-press" && pressOpen && !wasPressOpenBeforeInteraction;
  const passiveClose = reason === "trigger-hover" || reason === "focus-out";
  return freshPressClose || (pressOpen && passiveClose);
}

function shouldCancelOpen(reason: OpenChangeReason, dismissLocked: boolean): boolean {
  const passiveOpen = reason === "trigger-hover" || reason === "trigger-focus";
  return dismissLocked && passiveOpen;
}

function createsDismissLock(reason: OpenChangeReason): boolean {
  return reason === "escape-key" || reason === "close-press";
}

export function InteractivePopover(props: Props) {
  const [open, setOpen] = useState(false);
  const dismissLockRef = useRef(false);
  const pressOpenRef = useRef(false);
  const wasPressOpenBeforeInteractionRef = useRef(false);

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails: Parameters<NonNullable<PopoverPrimitive.Root.Props["onOpenChange"]>>[1],
  ): void {
    if (!nextOpen) {
      if (
        shouldCancelClose(
          eventDetails.reason,
          pressOpenRef.current,
          wasPressOpenBeforeInteractionRef.current,
        )
      ) {
        eventDetails.cancel();
        return;
      }
      setOpen(false);
      pressOpenRef.current = false;
      dismissLockRef.current = createsDismissLock(eventDetails.reason);
      return;
    }

    if (shouldCancelOpen(eventDetails.reason, dismissLockRef.current)) {
      eventDetails.cancel();
      return;
    }
    dismissLockRef.current = false;
    if (eventDetails.reason === "trigger-press") pressOpenRef.current = true;
    setOpen(true);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={100}
        onPointerDown={() => {
          wasPressOpenBeforeInteractionRef.current = pressOpenRef.current;
          pressOpenRef.current = true;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            wasPressOpenBeforeInteractionRef.current = pressOpenRef.current;
            pressOpenRef.current = true;
          }
        }}
        onPointerEnter={() => {
          dismissLockRef.current = false;
        }}
        onPointerLeave={() => {
          dismissLockRef.current = false;
        }}
        onFocus={() => {
          if (!dismissLockRef.current) setOpen(true);
        }}
        onBlur={() => {
          dismissLockRef.current = false;
        }}
        aria-label={props.ariaLabel}
        className="relative z-20 grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <props.TriggerIcon className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        sideOffset={8}
        collisionPadding={12}
        className="max-w-72 gap-0 rounded-xl border p-4 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <PopoverTitle className="font-semibold">{props.title}</PopoverTitle>
          <PopoverPrimitive.Close
            aria-label={m.close()}
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </PopoverPrimitive.Close>
        </div>
        <PopoverDescription className="mt-2">{props.children}</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
