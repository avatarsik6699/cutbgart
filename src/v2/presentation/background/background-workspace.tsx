import { type ChangeEvent } from "react";

import { m } from "@/paraglide/messages";
import { BACKGROUND_GRADIENT_PRESETS } from "@/shared/lib";
import { Button, buttonVariants, EditorStage, Typography } from "@/shared/ui";
import { BeforeAfterUrlSlider } from "@/entities/processed-image";
import type { BackgroundDraft, BackgroundFillDescriptor } from "@/v2/domain";
import type { BackgroundRuntimeSnapshot } from "@/v2/runtime-browser";
import { ToolPanelSlot } from "../shared";

import { WorkspaceComparisonImage } from "../editor-tools/workspace-comparison-image";
import { backgroundFillStyle } from "./background-fill-style";

type Props = {
  draft: BackgroundDraft;
  foregroundUrl: string;
  height: number;
  runtime: BackgroundRuntimeSnapshot;
  sourceUrl: string;
  interaction: BackgroundInteraction;
  width: number;
};

export type BackgroundInteraction = Readonly<{
  apply(): void;
  cancel(): void;
  change(fill: BackgroundFillDescriptor): void;
  selectImage(file: File): void;
}>;

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
  const busy =
    props.draft.status === "applying" || props.runtime.status === "preparing-image";
  const colour = props.draft.fill.type === "color" ? props.draft.fill.value : "#FFFFFF";

  function selectImageFx(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    if (file !== undefined) props.interaction.selectImage(file);
    event.currentTarget.value = "";
  }

  return (
    <>
      <div className="[grid-area:surface]">
        <EditorStage documentId={props.draft.documentId}>
          <BeforeAfterUrlSlider
            afterUrl={props.foregroundUrl}
            beforeUrl={props.sourceUrl}
            backgroundStyle={backgroundFillStyle(
              props.draft.fill,
              props.runtime.previewUrl,
            )}
            transparentBackground={props.draft.fill.type === "transparent"}
            width={props.width}
            height={props.height}
            renderImage={(image) => (
              <WorkspaceComparisonImage
                image={image}
                width={props.width}
                height={props.height}
              />
            )}
          />
        </EditorStage>
      </div>
      <div className="[grid-area:rail]">
        <ToolPanelSlot toolId="background" label={m.editorV2BackgroundTitle()} autoFocus>
          <section className="flex h-full min-h-0 min-w-0 max-w-full flex-col gap-5 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
            <fieldset className="flex flex-col gap-2" disabled={busy}>
              <legend className="font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {m.backgroundFillSectionLabel()}
              </legend>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={
                    props.draft.fill.type === "transparent" ? "default" : "outline"
                  }
                  aria-pressed={props.draft.fill.type === "transparent"}
                  onClick={() => props.interaction.change({ type: "transparent" })}
                >
                  <span
                    aria-hidden="true"
                    className="transparency-grid size-4 rounded-full border border-border"
                  />
                  {m.transparent()}
                </Button>
                <label
                  className={buttonVariants({
                    variant: props.draft.fill.type === "color" ? "default" : "outline",
                    className: "cursor-pointer",
                  })}
                >
                  <input
                    type="color"
                    value={colour}
                    aria-label={m.editorV2BackgroundColorPicker()}
                    className="sr-only"
                    onChange={(event) =>
                      props.interaction.change({
                        type: "color",
                        value: event.currentTarget.value.toUpperCase() as `#${string}`,
                      })
                    }
                  />
                  <span
                    aria-hidden="true"
                    className="size-4 rounded-full border border-border"
                    style={{ backgroundColor: colour }}
                  />
                  {m.color()}
                </label>
                {BACKGROUND_GRADIENT_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="outline"
                    className={
                      presetSelected(props.draft.fill, preset)
                        ? "border-primary bg-primary/15 text-foreground"
                        : undefined
                    }
                    aria-pressed={presetSelected(props.draft.fill, preset)}
                    onClick={() => props.interaction.change(presetFill(preset))}
                  >
                    <span
                      aria-hidden="true"
                      className="size-4 rounded-full border border-border"
                      style={{
                        backgroundImage:
                          preset.kind === "linear"
                            ? `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})`
                            : `radial-gradient(circle, ${preset.colors[0]}, ${preset.colors[1]})`,
                      }}
                    />
                    {presetLabel(preset.id)}
                  </Button>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="flex min-w-0 max-w-full cursor-pointer flex-col gap-2 text-sm font-medium">
                <span className="font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {m.customImage()}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label={m.editorV2BackgroundChooseImage()}
                  className="block w-full min-w-0 max-w-full overflow-hidden text-ellipsis text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2"
                  disabled={busy}
                  onChange={selectImageFx}
                />
                <span className="text-xs font-normal text-muted-foreground">
                  {m.editorV2BackgroundImageLimits()}
                </span>
              </label>
            </div>

            <Typography
              variant="body-small"
              as="p"
              role={props.runtime.status === "error" ? "alert" : "status"}
              aria-live="polite"
              className={`${
                props.runtime.status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              } ${!props.draft.dirty && props.runtime.status === "ready" ? "sr-only" : ""}`}
            >
              {backgroundStatus(props)}
            </Typography>

            {props.draft.dirty ? (
              <Typography variant="caption" as="p" className="text-muted-foreground">
                {m.editorV2BackgroundExportNotice()}
              </Typography>
            ) : null}

            <div className="mt-auto flex min-w-0 flex-wrap items-center gap-2 pt-2">
              <Button
                onClick={() => props.interaction.apply()}
                disabled={!props.draft.dirty || busy || props.runtime.status === "error"}
              >
                {m.backgroundApply()}
              </Button>
              <Button
                variant="outline"
                onClick={() => props.interaction.cancel()}
                disabled={!props.draft.dirty && !busy && props.runtime.status === "ready"}
              >
                {m.cancel()}
              </Button>
            </div>
          </section>
        </ToolPanelSlot>
      </div>
    </>
  );
}
