import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib";
import { trackEvent } from "@/shared/lib/analytics";
import { Button } from "@/shared/ui";
import {
  availableExportSizes,
  createExport,
  type ExportSourceDimensions,
} from "../lib/create-export";
import { createResultsZip } from "../lib/create-results-zip";
import {
  DEFAULT_EXPORT_SETTINGS,
  type ExportSettings,
  type ExportSize,
} from "../model/types";
import { DownloadControl } from "./download-control";

export type DownloadSplitButtonProps = {
  image?: Blob;
  source?: ExportSourceDimensions;
  settings?: ExportSettings;
  onSettingsChange?: (settings: ExportSettings) => void;
  batchItems?: Array<{
    originalFileName: string;
    processedImage?: { result: Blob; backgroundPending?: boolean };
  }>;
  disabled?: boolean;
  className?: string;
};

function sizeLabel(size: ExportSize): string {
  return size === "original" ? m.exportOriginal() : `${String(size)} px`;
}

export function DownloadSplitButton(props: DownloadSplitButtonProps) {
  const image = props.image;
  const source = props.source;
  const settings = props.settings ?? DEFAULT_EXPORT_SETTINGS;
  const onSettingsChange = props.onSettingsChange;
  const batchItems = props.batchItems ?? [];
  const disabled = props.disabled ?? false;
  const className = props.className;
  const hasCurrent = Boolean(image && source && onSettingsChange);
  const completedBatchItems = batchItems.filter((item) => item.processedImage);
  const batchDownloadDisabled =
    !completedBatchItems.length ||
    completedBatchItems.some((item) => item.processedImage?.backgroundPending);
  const sizes = source ? availableExportSizes(source) : (["original"] as const);
  const selectedSize = sizes.includes(settings.longestSide)
    ? settings.longestSide
    : "original";
  const effectiveSettings: ExportSettings = {
    format: "png",
    longestSide: selectedSize,
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);

  useEffect(function releaseExportRequestFx() {
    return function abortExportRequestFx() {
      requestRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  function selectSize(longestSide: ExportSize) {
    requestRef.current += 1;
    abortRef.current?.abort();
    setBusy(false);
    setError(null);
    onSettingsChange?.({ format: "png", longestSide });
    setAnnouncement(m.exportSizeSelected({ size: sizeLabel(longestSide) }));
  }

  async function startExport(nextSettings = effectiveSettings) {
    if (!image || !source) return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const output = await createExport(image, source, nextSettings, {
        signal: controller.signal,
      });
      if (requestRef.current !== request || controller.signal.aborted) return;
      const url = URL.createObjectURL(output.blob);
      try {
        trackEvent("download_clicked");
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = output.fileName;
        anchor.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    } catch (reason) {
      if (
        requestRef.current !== request ||
        controller.signal.aborted ||
        (reason instanceof DOMException && reason.name === "AbortError")
      )
        return;
      setError(m.exportFailed());
    } finally {
      if (requestRef.current === request) setBusy(false);
    }
  }

  async function startBatchExport() {
    if (batchDownloadDisabled) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await createResultsZip(completedBatchItems);
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "cutbg-results.zip";
        anchor.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    } catch {
      setError(m.exportFailed());
    } finally {
      setBusy(false);
    }
  }

  if (hasCurrent && batchItems.length === 0) {
    return (
      <DownloadControl
        announcement={announcement}
        busy={busy}
        className={className}
        disabled={disabled}
        error={error}
        onDownload={() => void startExport()}
        onRetry={() => void startExport()}
        onSelectSize={selectSize}
        onUseOriginal={() => {
          const original: ExportSettings = {
            format: "png",
            longestSide: "original",
          };
          onSettingsChange?.(original);
          setAnnouncement(m.exportSizeSelected({ size: sizeLabel("original") }));
          void startExport(original);
        }}
        selectedSize={selectedSize}
        sizes={sizes}
      />
    );
  }

  let downloadLabel = m.downloadAll();
  if (busy) downloadLabel = m.exportPreparing();
  else if (hasCurrent) downloadLabel = m.download();

  return (
    <div className={cn("relative flex flex-col items-end", className)}>
      <Menu.Root disabled={disabled || busy || (!hasCurrent && batchDownloadDisabled)}>
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
            onClick={() => (hasCurrent ? void startExport() : void startBatchExport())}
            className="rounded-r-none border-r-primary-foreground/30 px-3 sm:px-4"
          >
            <Download aria-hidden="true" />
            {downloadLabel}
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
              {hasCurrent && (
                <Menu.Group>
                  <Menu.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {m.exportOutputSize()}
                  </Menu.GroupLabel>
                  <Menu.RadioGroup
                    value={selectedSize}
                    onValueChange={(value) => selectSize(value as ExportSize)}
                  >
                    {sizes.map((size) => (
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
              )}
              {hasCurrent && (
                <>
                  <div role="separator" className="my-1 h-px bg-border" />
                  <Menu.Item
                    onClick={() => void startExport()}
                    className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium outline-none data-highlighted:bg-muted"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    {m.download()}
                  </Menu.Item>
                </>
              )}
              {completedBatchItems.length > 0 && (
                <>
                  <div role="separator" className="my-1 h-px bg-border" />
                  <Menu.Item
                    disabled={batchDownloadDisabled}
                    onClick={() => void startBatchExport()}
                    className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium outline-none data-highlighted:bg-muted data-disabled:opacity-50"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    {m.downloadAllZip()}
                  </Menu.Item>
                </>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {announcement && (
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-destructive/40 bg-background p-3 text-sm shadow-lg"
        >
          <p>{error}</p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (hasCurrent ? void startExport() : void startBatchExport())}
            >
              {m.tryAgain()}
            </Button>
            {selectedSize !== "original" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const original: ExportSettings = {
                    format: "png",
                    longestSide: "original",
                  };
                  onSettingsChange?.(original);
                  setAnnouncement(m.exportSizeSelected({ size: sizeLabel("original") }));
                  void startExport(original);
                }}
              >
                {m.exportUseOriginal()}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
