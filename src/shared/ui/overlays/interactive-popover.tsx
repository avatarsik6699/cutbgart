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

export function InteractivePopover(props: Props) {
  const [open, setOpen] = useState(false);
  const dismissLockRef = useRef(false);
  const pressOpenRef = useRef(false);
  const wasPressOpenBeforeInteractionRef = useRef(false);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen) {
          if (
            eventDetails.reason === "trigger-press" &&
            pressOpenRef.current &&
            !wasPressOpenBeforeInteractionRef.current
          ) {
            eventDetails.cancel();
            return;
          }

          if (
            pressOpenRef.current &&
            (eventDetails.reason === "trigger-hover" ||
              eventDetails.reason === "focus-out")
          ) {
            eventDetails.cancel();
            return;
          }

          setOpen(false);
          pressOpenRef.current = false;
          dismissLockRef.current =
            eventDetails.reason === "escape-key" || eventDetails.reason === "close-press";
          return;
        }

        if (
          dismissLockRef.current &&
          (eventDetails.reason === "trigger-hover" ||
            eventDetails.reason === "trigger-focus")
        ) {
          eventDetails.cancel();
          return;
        }

        dismissLockRef.current = false;
        if (eventDetails.reason === "trigger-press") {
          pressOpenRef.current = true;
        }
        setOpen(true);
      }}
    >
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
