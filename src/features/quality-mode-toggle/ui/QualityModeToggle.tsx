import type { AutomaticModelMode } from "../../../entities/processed-image";
import { Cpu, Gauge, TriangleAlert } from "lucide-react";
import { m } from "@/paraglide/messages";

const MODE_OPTIONS = [
  {
    id: "isnet-q8",
    approximateBytes: 44_348_381,
    relativeSpeed: "fast",
    requiresWebGPU: false,
  },
  {
    id: "isnet-fp32",
    approximateBytes: 176_114_856,
    relativeSpeed: "balanced",
    requiresWebGPU: false,
  },
  {
    id: "ben2-fp16",
    approximateBytes: 219_121_675,
    relativeSpeed: "slow",
    requiresWebGPU: true,
  },
] as const satisfies ReadonlyArray<{
  id: AutomaticModelMode;
  approximateBytes: number;
  relativeSpeed: "fast" | "balanced" | "slow";
  requiresWebGPU: boolean;
}>;

export interface QualityModeToggleProps {
  qualityMode: AutomaticModelMode;
  onQualityModeChange: (mode: AutomaticModelMode) => void;
  disabled?: boolean;
}

export function QualityModeToggle({
  qualityMode,
  onQualityModeChange,
  disabled = false,
}: QualityModeToggleProps) {
  return (
    <fieldset className="w-full space-y-2" data-testid="processing-mode-selector">
      <legend className="flex items-center gap-2 text-sm font-semibold">
        <Gauge className="size-4 text-primary" aria-hidden="true" />
        {m.processingModeLabel()}
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {MODE_OPTIONS.map((profile) => {
          const selected = qualityMode === profile.id;
          const name =
            profile.id === "isnet-q8"
              ? m.processingModeFast()
              : profile.id === "isnet-fp32"
                ? m.processingModePrecise()
                : m.processingModeBen2();
          return (
            <label
              key={profile.id}
              className={`relative cursor-pointer rounded-xl border p-3 text-left text-sm transition-colors ${selected ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/50"}`}
            >
              <input
                type="radio"
                name="processing-mode"
                value={profile.id}
                checked={selected}
                onChange={() => onQualityModeChange(profile.id)}
                disabled={disabled}
                className="absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />
              <span className="block font-medium">{name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {m.processingModeMeta({
                  size: String(Math.round(profile.approximateBytes / 1_000_000)),
                  speed:
                    profile.relativeSpeed === "fast"
                      ? m.processingSpeedFast()
                      : profile.relativeSpeed === "balanced"
                        ? m.processingSpeedBalanced()
                        : m.processingSpeedSlow(),
                  path: profile.requiresWebGPU ? "WebGPU" : "WebGPU / WASM",
                })}
              </span>
              {profile.id === "ben2-fp16" && (
                <span className="mt-2 flex gap-1 text-xs text-amber-700 dark:text-amber-400">
                  <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  {m.processingModeMemoryWarning()}
                </span>
              )}
              {profile.id !== "ben2-fp16" && (
                <Cpu className="mt-2 size-3 text-muted-foreground" aria-hidden="true" />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
