import { Popover } from "@base-ui/react/popover";
import { CircleHelp, Gauge, Gem, Scale, X, Zap } from "lucide-react";
import { useRef, useState } from "react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib/utils";
import type { AutomaticModelMode } from "../../../entities/processed-image";

const PUBLIC_MODE_OPTIONS = [
  {
    id: "isnet-q8",
    icon: Zap,
    label: () => m.processingModeFast(),
    hint: () => m.processingModeFastHint(),
    meta: () => m.processingModeFastMeta(),
  },
  {
    id: "isnet-fp32",
    icon: Scale,
    label: () => m.processingModePrecise(),
    hint: () => m.processingModeOptimalHint(),
    meta: () => m.processingModeOptimalMeta(),
  },
  {
    id: "ben2-fp16",
    icon: Gem,
    label: () => m.processingModeBen2(),
    hint: () => m.processingModeMaximumHint(),
    meta: () => m.processingModeMaximumMeta(),
  },
] as const satisfies ReadonlyArray<{
  id: AutomaticModelMode;
  icon: typeof Zap;
  label: () => string;
  hint: () => string;
  meta: () => string;
}>;

export interface QualityModeToggleProps {
  qualityMode: AutomaticModelMode;
  onQualityModeChange: (mode: AutomaticModelMode) => void;
  disabled?: boolean;
}

function MaximumQualityHelp() {
  const [open, setOpen] = useState(false);
  const dismissLockRef = useRef(false);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen) {
          setOpen(false);
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
        setOpen(true);
      }}
    >
      <Popover.Trigger
        openOnHover
        delay={150}
        closeDelay={100}
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
        aria-label={m.processingModeMaximumHelpLabel()}
        className="relative z-20 grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <CircleHelp className="size-3.5" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} collisionPadding={12} className="z-50">
          <Popover.Popup className="max-w-72 rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-lg outline-none">
            <div className="flex items-start justify-between gap-3">
              <Popover.Title className="font-semibold">
                {m.processingModeMaximumHelpTitle()}
              </Popover.Title>
              <Popover.Close
                aria-label={m.close()}
                className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </Popover.Close>
            </div>
            <Popover.Description className="mt-2 text-muted-foreground">
              {m.processingModeMaximumHelpBody()}
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function QualityModeToggle({
  qualityMode,
  onQualityModeChange,
  disabled = false,
}: QualityModeToggleProps) {
  return (
    <fieldset
      className="w-full space-y-2 [container-type:inline-size]"
      data-testid="processing-mode-selector"
    >
      <legend className="flex items-center gap-2 text-sm font-semibold">
        <Gauge className="size-4 text-primary" aria-hidden="true" />
        {m.processingModeLabel()}
      </legend>
      <div className="flex flex-col gap-2 @[28rem]:grid @[28rem]:grid-cols-3">
        {PUBLIC_MODE_OPTIONS.map((profile) => {
          const Icon = profile.icon;
          const selected = qualityMode === profile.id;
          const isMaximum = profile.id === "ben2-fp16";
          return (
            <div
              key={profile.id}
              className={cn(
                "group relative flex min-w-0 items-start rounded-lg border transition-[border-color,background-color] duration-200 motion-reduce:transition-none",
                selected
                  ? "border-primary bg-primary/[0.055]"
                  : isMaximum
                    ? "border-transparent bg-background/55 hover:bg-background/90"
                    : "border-border/80 bg-background/55 hover:border-foreground/20 hover:bg-background/90",
                isMaximum && "quality-mode-shimmer",
              )}
              data-selected={selected || undefined}
            >
              <label className="relative min-w-0 flex-1 cursor-pointer p-3 text-left text-sm">
                <input
                  type="radio"
                  name="processing-mode"
                  value={profile.id}
                  checked={selected}
                  onChange={() => onQualityModeChange(profile.id)}
                  disabled={disabled}
                  className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                />
                <span className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-lg transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="truncate font-medium leading-5">
                      {profile.label()}
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                      {profile.meta()}
                    </span>
                    <span className="sr-only">{profile.hint()}</span>
                  </span>
                </span>
              </label>
              {isMaximum && (
                <div className="relative z-20 shrink-0 self-start pt-1.5 pr-1.5">
                  <MaximumQualityHelp />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
