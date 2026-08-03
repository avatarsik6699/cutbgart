import { useEffect, useRef, type ChangeEvent } from "react";

import { m } from "@/paraglide/messages";
import { BACKGROUND_GRADIENT_PRESETS } from "@/shared/lib";
import { Button } from "@/shared/ui";
import type { BackgroundDraft, BackgroundFillDescriptor } from "@/v2/domain";
import type { BackgroundRuntimeSnapshot, EditorSession } from "@/v2/runtime-browser";
import { Typography } from "@/v2/shared/ui";

import { BackgroundPreview } from "./background-preview";

type Props = {
  draft: BackgroundDraft;
  foregroundUrl: string;
  height: number;
  runtime: BackgroundRuntimeSnapshot;
  session: EditorSession;
  width: number;
};

function presetLabel(id: (typeof BACKGROUND_GRADIENT_PRESETS)[number]["id"]): string {
  const labels = {
    sunset: m.gradientSunset,
    ocean: m.gradientOcean,
    mint: m.gradientMint,
    spotlight: m.gradientSpotlight,
    peach: m.gradientPeach,
    night: m.gradientNight,
  };
  return labels[id]();
}

function presetFill(
  preset: (typeof BACKGROUND_GRADIENT_PRESETS)[number],
): BackgroundFillDescriptor {
  return {
    type: "gradient",
    kind: preset.kind,
    stops: [
      { offset: 0, color: preset.colors[0] },
      { offset: 1, color: preset.colors[1] },
    ],
  };
}

function presetSelected(
  fill: BackgroundFillDescriptor,
  preset: (typeof BACKGROUND_GRADIENT_PRESETS)[number],
): boolean {
  return (
    fill.type === "gradient" &&
    fill.kind === preset.kind &&
    fill.stops[0].color === preset.colors[0] &&
    fill.stops[1].color === preset.colors[1]
  );
}

function backgroundStatus(props: Props): string {
  if (props.runtime.status === "preparing-image")
    return m.editorV2BackgroundPreparingImage();
  if (props.runtime.status === "error") return m.editorV2BackgroundImageError();
  if (props.draft.status === "applying") return m.editorV2BackgroundApplying();
  return props.draft.dirty ? m.editorV2BackgroundDirty() : m.editorV2BackgroundClean();
}

export function BackgroundWorkspace(props: Props) {
  const workspaceRef = useRef<HTMLElement>(null);
  const busy =
    props.draft.status === "applying" || props.runtime.status === "preparing-image";
  const colour = props.draft.fill.type === "color" ? props.draft.fill.value : "#FFFFFF";

  function selectImageFx(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    if (file !== undefined) void props.session.selectBackgroundImage(file);
    event.currentTarget.value = "";
  }

  useEffect(function focusBackgroundWorkspaceFx() {
    workspaceRef.current?.focus();
  }, []);

  return (
    <section
      ref={workspaceRef}
      tabIndex={-1}
      className="border-border bg-card/60 grid gap-4 rounded-xl border p-4 sm:p-5"
      aria-label={m.editorV2BackgroundTitle()}
    >
      <div>
        <Typography variant="heading-2" as="h2">
          {m.editorV2BackgroundTitle()}
        </Typography>
        <Typography variant="caption" as="p" className="text-muted-foreground mt-1">
          {m.editorV2BackgroundHint()}
        </Typography>
      </div>

      <BackgroundPreview
        fill={props.draft.fill}
        foregroundUrl={props.foregroundUrl}
        height={props.height}
        imageUrl={props.runtime.previewUrl}
        width={props.width}
      />

      <fieldset className="grid gap-3" disabled={busy}>
        <legend>
          <Typography variant="label" as="span">
            {m.editorV2BackgroundFill()}
          </Typography>
        </legend>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={props.draft.fill.type === "transparent" ? "default" : "outline"}
            onClick={() => props.session.changeBackground({ type: "transparent" })}
          >
            {m.editorV2BackgroundTransparent()}
          </Button>
          <label className="border-border bg-background focus-within:ring-ring inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 font-mono text-sm focus-within:ring-2">
            {m.editorV2BackgroundColor()}
            <input
              type="color"
              value={colour}
              aria-label={m.editorV2BackgroundColorPicker()}
              className="size-6 cursor-pointer border-0 bg-transparent p-0"
              onChange={(event) =>
                props.session.changeBackground({
                  type: "color",
                  value: event.currentTarget.value.toUpperCase() as `#${string}`,
                })
              }
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-3" disabled={busy}>
        <legend>
          <Typography variant="label" as="span">
            {m.editorV2BackgroundGradients()}
          </Typography>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BACKGROUND_GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="border-border focus-visible:ring-ring relative min-h-14 overflow-hidden rounded-md border text-left focus-visible:ring-2 disabled:opacity-50"
              style={{
                backgroundImage:
                  preset.kind === "linear"
                    ? `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})`
                    : `radial-gradient(circle, ${preset.colors[0]}, ${preset.colors[1]})`,
              }}
              aria-pressed={presetSelected(props.draft.fill, preset)}
              onClick={() => props.session.changeBackground(presetFill(preset))}
            >
              <Typography
                variant="caption"
                as="span"
                className="bg-background/85 absolute right-1.5 bottom-1.5 left-1.5 rounded px-2 py-1"
              >
                {presetLabel(preset.id)}
              </Typography>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <Typography variant="label" as="p">
          {m.editorV2BackgroundCustomImage()}
        </Typography>
        <label className="border-border bg-background focus-within:ring-ring inline-flex w-fit cursor-pointer items-center rounded-md border px-3 py-2 font-mono text-sm focus-within:ring-2">
          {m.editorV2BackgroundChooseImage()}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={selectImageFx}
          />
        </label>
        <Typography variant="caption" as="p" className="text-muted-foreground">
          {m.editorV2BackgroundImageLimits()}
        </Typography>
      </div>

      <Typography
        variant="body-small"
        as="p"
        role={props.runtime.status === "error" ? "alert" : "status"}
        aria-live="polite"
        className={
          props.runtime.status === "error" ? "text-destructive" : "text-muted-foreground"
        }
      >
        {backgroundStatus(props)}
      </Typography>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => props.session.cancelBackground()}>
          {m.editorV2Cancel()}
        </Button>
        <Button
          onClick={() => props.session.applyBackground()}
          disabled={!props.draft.dirty || busy || props.runtime.status === "error"}
        >
          {m.editorV2Apply()}
        </Button>
      </div>
    </section>
  );
}
