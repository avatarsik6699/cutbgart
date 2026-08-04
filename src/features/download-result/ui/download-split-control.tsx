import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, Download } from "lucide-react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";

import type { ExportSize } from "../model/types";

export type DownloadSplitControlProps = Readonly<{
  announcement?: string;
  busy?: boolean;
  className?: string;
  disabled?: boolean;
  error?: string | null;
  onDownload: () => void;
  onRetry?: () => void;
  onSelectSize: (size: ExportSize) => void;
  onUseOriginal?: () => void;
  selectedSize: ExportSize;
  sizes: readonly ExportSize[];
}>;

function sizeLabel(size: ExportSize): string {
  return size === "original" ? m.exportOriginal() : `${String(size)} px`;
}

/** Controller-neutral single-image export control shared by legacy and v2. */
export function DownloadSplitControl(props: DownloadSplitControlProps) {
  const announcement = props.announcement ?? "";
  const busy = props.busy ?? false;
  const disabled = props.disabled ?? false;
  const error = props.error ?? null;
  const onRetry = props.onRetry ?? props.onDownload;
  return (
    <div className={cn("relative flex flex-col items-end", props.className)}>
      <Menu.Root disabled={disabled || busy}>
        <div
          role="group"
          aria-label={m.downloadOptions()}
          className="flex shrink-0"
          data-testid="download-split-button"
        >
          <Button
            type="button"
            disabled={disabled || busy}
            aria-busy={busy}
            onClick={props.onDownload}
            className="rounded-r-none border-r-primary-foreground/30 px-3 sm:px-4"
          >
            <Download aria-hidden="true" />
            {busy ? m.exportPreparing() : m.download()}
          </Button>
          <Menu.Trigger
            render={
              <Button
                type="button"
                disabled={disabled || busy}
                aria-label={m.downloadOptions()}
                className="rounded-l-none px-2"
              />
            }
          >
            <ChevronDown aria-hidden="true" />
          </Menu.Trigger>
        </div>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
            <Menu.Popup className="min-w-56 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
              <Menu.Group>
                <Menu.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {m.exportOutputSize()}
                </Menu.GroupLabel>
                <Menu.RadioGroup
                  value={props.selectedSize}
                  onValueChange={(value) => props.onSelectSize(value as ExportSize)}
                >
                  {props.sizes.map((size) => (
                    <Menu.RadioItem
                      key={size}
                      value={size}
                      className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-highlighted:bg-muted"
                    >
                      <span className="flex size-4 items-center justify-center">
                        <Menu.RadioItemIndicator>
                          <Check className="size-4" aria-hidden="true" />
                        </Menu.RadioItemIndicator>
                      </span>
                      {sizeLabel(size)}
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.Group>
              <div role="separator" className="my-1 h-px bg-border" />
              <Menu.Item
                onClick={props.onDownload}
                className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium outline-none data-highlighted:bg-muted"
              >
                <Download className="size-4" aria-hidden="true" />
                {m.download()}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {announcement ? (
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-destructive/40 bg-background p-3 text-sm shadow-lg"
        >
          <p>{error}</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              {m.tryAgain()}
            </Button>
            {props.selectedSize !== "original" && props.onUseOriginal ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={props.onUseOriginal}
              >
                {m.exportUseOriginal()}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
