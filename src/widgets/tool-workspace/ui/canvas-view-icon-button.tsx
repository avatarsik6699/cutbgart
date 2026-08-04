import type { ReactNode } from "react";

import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui";

type Props = Readonly<{
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick(): void;
  pressed?: boolean;
  shortcut?: string;
}>;

export function CanvasViewIconButton(props: Props) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant={props.pressed ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={props.label}
            aria-pressed={props.pressed}
            disabled={props.disabled}
            onClick={() => props.onClick()}
          />
        }
      >
        {props.children}
      </TooltipTrigger>
      <TooltipContent>
        <span>{props.label}</span>
        {props.shortcut ? (
          <kbd className="ml-2 rounded border border-background/30 bg-background/15 px-1.5 py-0.5 font-mono text-[0.625rem] text-background">
            {props.shortcut}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
