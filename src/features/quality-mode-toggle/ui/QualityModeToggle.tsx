import { Popover } from "@base-ui/react/popover";
import { CircleHelp, Gauge, X } from "lucide-react";
import { useRef, useState } from "react";

import { m } from "@/paraglide/messages";
import type { AutomaticModelMode } from "../../../entities/processed-image";

const PUBLIC_MODE_OPTIONS = [
  {
    id: "isnet-q8",
    label: () => m.processingModeFast(),
    hint: () => m.processingModeFastHint(),
  },
  {
    id: "isnet-fp32",
    label: () => m.processingModePrecise(),
    hint: () => m.processingModeOptimalHint(),
  },
  {
    id: "ben2-fp16",
    label: () => m.processingModeBen2(),
    hint: () => m.processingModeMaximumHint(),
  },
] as const satisfies ReadonlyArray<{
  id: AutomaticModelMode;
  label: () => string;
  hint: () => string;
}>;

export interface QualityModeToggleProps {
  qualityMode: AutomaticModelMode;
  onQualityModeChange: (mode: AutomaticModelMode) => void;
  recommendedMode?: AutomaticModelMode;
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
        className="relative z-20 grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <CircleHelp className="size-4" aria-hidden="true" />
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
  recommendedMode = "isnet-fp32",
  disabled = false,
}: QualityModeToggleProps) {
  return (
    <fieldset className="w-full space-y-2" data-testid="processing-mode-selector">
      <legend className="flex items-center gap-2 text-sm font-semibold">
        <Gauge className="size-4 text-primary" aria-hidden="true" />
        {m.processingModeLabel()}
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {PUBLIC_MODE_OPTIONS.map((profile) => {
          const selected = qualityMode === profile.id;
          const recommended = profile.id === recommendedMode;
          return (
            <div
              key={profile.id}
              className={`relative flex min-w-0 rounded-xl border transition-colors ${
                selected
                  ? "border-primary bg-primary/5"
                  : "bg-background hover:bg-muted/50"
              }`}
            >
              <label className="relative min-w-0 flex-1 cursor-pointer p-3 text-left text-sm">
                <input
                  type="radio"
                  name="processing-mode"
                  value={profile.id}
                  checked={selected}
                  onChange={() => onQualityModeChange(profile.id)}
                  disabled={disabled}
                  className="absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                />
                <span className="flex flex-wrap items-center gap-1.5 font-medium">
                  {profile.label()}
                  {profile.id === "ben2-fp16" && (
                    <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                      {m.beta()}
                    </span>
                  )}
                  {recommended && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-primary">
                      {m.processingModeRecommended()}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {profile.hint()}
                </span>
              </label>
              {profile.id === "ben2-fp16" && (
                <div className="self-start p-2">
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
