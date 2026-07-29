import type { BackgroundFill, ProcessedImage } from "../../../entities/processed-image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui";
import { m } from "@/paraglide/messages";
import { DEFAULT_COLOR, GRADIENT_PRESETS, TRANSPARENT_FILL } from "../model/types";
import { useBackgroundFill } from "../model/use-background-fill";
import { InlineColorPicker } from "./InlineColorPicker";

function gradientName(name: (typeof GRADIENT_PRESETS)[number]["name"]): string {
  return {
    Sunset: m.gradientSunset(),
    Ocean: m.gradientOcean(),
    Mint: m.gradientMint(),
    Spotlight: m.gradientSpotlight(),
    Peach: m.gradientPeach(),
    Night: m.gradientNight(),
  }[name];
}

export function BackgroundFillSelector({
  image,
  onPreview,
  onApply,
  onResult,
  onBusyChange,
  onDirtyChange,
}: {
  // See `useBackgroundFill`'s `image` param doc — deliberately excludes
  // `alphaMatte` (and everything else) so switching the selected image never
  // hands this component a changed prop containing a large typed array.
  image: Pick<ProcessedImage, "source" | "backgroundFill">;
  onPreview: (fill: BackgroundFill) => void;
  onApply: (fill: BackgroundFill) => Promise<ProcessedImage>;
  onResult: (image: ProcessedImage) => void;
  onBusyChange?: (busy: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const {
    fill,
    dirty,
    saving,
    busy,
    error,
    preview,
    selectColor,
    selectImage,
    save,
    cancel,
  } = useBackgroundFill({
    image,
    onPreview,
    onApply,
    onResult,
  });
  const currentColor = fill.type === "color" ? fill.value : DEFAULT_COLOR;
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const busyCallbackRef = useRef(onBusyChange);
  const dirtyCallbackRef = useRef(onDirtyChange);
  useEffect(() => {
    busyCallbackRef.current = onBusyChange;
  }, [onBusyChange]);
  useEffect(() => {
    dirtyCallbackRef.current = onDirtyChange;
  }, [onDirtyChange]);
  useEffect(() => {
    busyCallbackRef.current?.(busy);
  }, [busy]);
  useEffect(() => {
    dirtyCallbackRef.current?.(dirty);
  }, [dirty]);
  return (
    <fieldset
      className="flex min-w-0 max-w-full flex-col gap-3 overflow-hidden rounded-lg border border-border p-4"
      aria-busy={saving}
    >
      <legend className="px-1 text-sm font-medium">{m.background()}</legend>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={fill.type === "transparent" ? "default" : "outline"}
          onClick={() => preview(TRANSPARENT_FILL)}
          aria-pressed={fill.type === "transparent"}
        >
          <span
            aria-hidden="true"
            data-testid="fill-swatch"
            className="transparency-grid size-4 rounded-full border border-border"
          />
          {m.transparent()}
        </Button>
        <Button
          type="button"
          variant={fill.type === "color" ? "default" : "outline"}
          aria-pressed={fill.type === "color"}
          aria-expanded={colorPickerOpen}
          aria-controls="background-color-picker"
          aria-label={m.backgroundColor()}
          onClick={() => {
            if (fill.type !== "color") selectColor(currentColor);
            setColorPickerOpen((open) => !open);
          }}
        >
          <span
            aria-hidden="true"
            data-testid="fill-swatch"
            className="size-4 rounded-full border border-border"
            style={{ backgroundColor: currentColor }}
          />
          {m.color()}
        </Button>
        {GRADIENT_PRESETS.map((preset) => (
          <Button
            key={preset.name}
            type="button"
            variant={
              fill.type === "gradient" &&
              fill.kind === preset.fill.kind &&
              fill.stops[0].color === preset.fill.stops[0].color
                ? "default"
                : "outline"
            }
            aria-pressed={
              fill.type === "gradient" &&
              fill.kind === preset.fill.kind &&
              fill.stops[0].color === preset.fill.stops[0].color
            }
            onClick={() => preview(preset.fill)}
          >
            <span
              aria-hidden="true"
              data-testid="fill-swatch"
              className="size-4 rounded-full border border-border"
              style={{
                backgroundImage: `${preset.fill.kind === "linear" ? "linear-gradient(135deg" : "radial-gradient(circle at center"}, ${preset.fill.stops[0].color}, ${preset.fill.stops[1].color})`,
              }}
            />
            {gradientName(preset.name)}
          </Button>
        ))}
      </div>
      {colorPickerOpen && (
        <div id="background-color-picker" className="flex flex-col items-start gap-2">
          <InlineColorPicker color={currentColor} onChange={selectColor} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setColorPickerOpen(false)}
          >
            {m.done()}
          </Button>
        </div>
      )}
      <label className="flex min-w-0 max-w-full cursor-pointer flex-col gap-1 text-sm font-medium">
        {m.customImage()}
        <input
          aria-label={m.customBackgroundImage()}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void selectImage(file);
            event.target.value = "";
          }}
          className="block w-full min-w-0 max-w-full overflow-hidden text-ellipsis text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2"
        />
      </label>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          aria-busy={saving}
        >
          {m.backgroundApply()}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={cancel}
          disabled={!dirty && !saving}
        >
          {m.cancel()}
        </Button>
        {(dirty || saving) && (
          <p role="status" className="text-sm text-muted-foreground">
            {saving ? m.savingBackground() : m.unsavedBackground()}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
