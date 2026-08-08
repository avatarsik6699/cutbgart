import { Menu } from "@base-ui/react/menu";
import { ChevronDown, Download } from "lucide-react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib";
import { Button, Typography } from "@/shared/ui";

import { DownloadError } from "./components/download-error";
import { ExportSizeMenu } from "./components/export-size-menu";
import type { DownloadControlTypes } from "./download-control.types";

export function DownloadControl(props: DownloadControlTypes.Props) {
  const { announcement = "", busy = false, disabled = false } = props;
  const retryDownload = props.onRetry ?? props.onDownload;

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
            <ExportSizeMenu
              batchZip={props.batchZip}
              onDownload={props.onDownload}
              onSelectSize={props.onSelectSize}
              selectedSize={props.selectedSize}
              sizes={props.sizes}
            />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {announcement ? (
        <Typography variant="caption" as="p" className="sr-only" role="status">
          {announcement}
        </Typography>
      ) : null}
      {props.error ? (
        <DownloadError
          message={props.error}
          onRetry={retryDownload}
          onUseOriginal={props.onUseOriginal}
          showOriginalFallback={props.selectedSize !== "original"}
        />
      ) : null}
    </div>
  );
}
