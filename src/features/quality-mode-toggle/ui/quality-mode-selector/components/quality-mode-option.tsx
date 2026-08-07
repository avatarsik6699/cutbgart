import { cn } from "@/shared/lib/utils";
import { Typography } from "@/shared/ui";

import { MaximumQualityHelp } from "./maximum-quality-help";
import type { QualityModeSelectorTypes } from "../quality-mode-selector.types";
import { optionContainerClassName } from "../quality-mode-selector.utils";

type Props = Readonly<{
  disabled: boolean;
  onSelect: (option: QualityModeSelectorTypes.Option["id"]) => void;
  option: QualityModeSelectorTypes.Option;
  selected: boolean;
}>;

export function QualityModeOption(props: Props) {
  const Icon = props.option.icon;

  return (
    <div
      className={cn(
        "group relative flex min-w-0 items-start rounded-lg border transition-[border-color,background-color] duration-200 motion-reduce:transition-none",
        optionContainerClassName(props.selected, props.option.emphasized),
        props.option.emphasized && "quality-mode-shimmer",
      )}
      data-selected={props.selected || undefined}
    >
      <label className="relative min-w-0 flex-1 cursor-pointer p-3 text-left text-sm">
        <input
          type="radio"
          name="processing-mode"
          value={props.option.id}
          checked={props.selected}
          onChange={() => props.onSelect(props.option.id)}
          disabled={props.disabled}
          className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg transition-colors",
              props.selected
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground group-hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <Typography variant="body-small" as="span" className="truncate font-medium">
              {props.option.label()}
            </Typography>
            <Typography
              variant="caption"
              as="span"
              className="mt-0.5 block leading-4 text-muted-foreground"
            >
              {props.option.meta()}
            </Typography>
            <span className="sr-only">{props.option.hint()}</span>
          </span>
        </span>
      </label>
      {props.option.emphasized ? (
        <div className="relative z-20 shrink-0 self-start pt-1.5 pr-1.5">
          <MaximumQualityHelp />
        </div>
      ) : null}
    </div>
  );
}
