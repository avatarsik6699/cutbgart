import { Menu } from "@base-ui/react/menu";
import { Download, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { m } from "@/paraglide/messages";

import { Button } from "../controls";
import {
  BatchWorkspaceStatus,
  type BatchWorkspaceSummary,
} from "./batch-workspace-status";

export type BatchWorkspaceRailItem = Readonly<{
  canDownload: boolean;
  canRetry: boolean;
  detail: string;
  errorDetail: string | null;
  id: string;
  name: string;
  PreviewSlot: ReactNode;
  retryLabel: string;
  selected: boolean;
  selectable: boolean;
  status: "preparing" | "queued" | "model-loading" | "processing" | "result" | "error";
}>;

const STATUS_STYLES: Record<BatchWorkspaceRailItem["status"], string> = {
  preparing: "bg-warning/95 text-warning-foreground dark:bg-warning/90",
  queued: "bg-background/90 text-muted-foreground",
  "model-loading": "bg-warning/95 text-warning-foreground dark:bg-warning/90",
  processing: "bg-info/95 text-info-foreground dark:bg-info/90",
  result: "bg-success/95 text-success-foreground dark:bg-success/90",
  error: "bg-destructive/90 text-destructive-foreground",
};

function statusLabel(status: BatchWorkspaceRailItem["status"]): string {
  if (status === "preparing" || status === "model-loading") return m.batchLoading();
  if (status === "queued") return m.batchQueued();
  if (status === "processing") return m.batchProcessingStatus();
  if (status === "result") return m.batchReady();
  return m.batchFailed();
}

export function BatchWorkspaceRail(props: {
  items: readonly BatchWorkspaceRailItem[];
  onDownload: (id: string) => void;
  onRemove: (id: string, trigger: HTMLButtonElement) => void;
  onRetry: (id: string, trigger: HTMLButtonElement) => void;
  onSelect: (id: string, trigger: HTMLButtonElement) => void;
  summary: BatchWorkspaceSummary;
}) {
  const itemMenuTriggers = useRef<Record<string, HTMLButtonElement | null>>({});
  return (
    <section
      className="flex min-w-0 flex-col gap-3 border-t border-border pt-3"
      aria-label={m.batchProcessing()}
      data-testid="batch-overview"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {m.batchImagesHeading()}
        </h3>
        <BatchWorkspaceStatus summary={props.summary} />
      </div>
      <div
        className="flex min-w-0 gap-2 overflow-x-auto pb-2 [overscroll-behavior-inline:contain]"
        data-testid="batch-filmstrip"
      >
        {props.items.map((item) => (
          <article
            key={item.id}
            className={`group relative w-32 shrink-0 overflow-hidden rounded-lg border bg-card text-card-foreground transition-[border-color,background-color] duration-200 motion-reduce:transition-none ${item.selectable ? "hover:border-foreground/30 hover:bg-accent/40" : "border-border"} ${item.selected ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
          >
            <button
              type="button"
              disabled={!item.selectable}
              onClick={(event) => props.onSelect(item.id, event.currentTarget)}
              aria-pressed={item.selectable ? item.selected : undefined}
              aria-label={
                item.selectable
                  ? m.batchSelectAria({ name: item.name, detail: item.detail })
                  : m.batchUnavailableAria({ name: item.name, detail: item.detail })
              }
              className="block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:cursor-wait"
            >
              <span className="relative block aspect-square overflow-hidden bg-muted/50">
                {item.PreviewSlot}
                <span
                  className={`absolute left-2 top-2 rounded-full px-2 py-1 font-mono text-[0.625rem] font-medium tracking-wide uppercase ${STATUS_STYLES[item.status]}`}
                >
                  {statusLabel(item.status)}
                </span>
              </span>
              <span className="block p-2">
                <span className="block truncate text-sm font-medium" title={item.name}>
                  {item.name}
                </span>
                <span
                  className="mt-1 block truncate text-[0.6875rem] text-muted-foreground"
                  data-testid="item-progress"
                >
                  {item.detail}
                </span>
              </span>
            </button>
            {item.errorDetail ? (
              <details className="border-t border-border px-2 py-1.5 text-xs">
                <summary className="cursor-pointer font-medium text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                  {m.batchErrorDetails()}
                </summary>
                <p className="mt-1 break-words text-muted-foreground">
                  {item.errorDetail}
                </p>
              </details>
            ) : null}
            <Menu.Root>
              <Menu.Trigger
                render={
                  <Button
                    ref={(node) => {
                      itemMenuTriggers.current[item.id] = node;
                    }}
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute right-2 top-2 z-20 border border-background/70 shadow-sm"
                    aria-label={m.batchItemActions({ name: item.name })}
                    data-testid="batch-item-actions"
                  />
                }
              >
                <MoreHorizontal aria-hidden="true" />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner
                  side="bottom"
                  align="end"
                  sideOffset={6}
                  className="z-50"
                >
                  <Menu.Popup className="min-w-56 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
                    {item.canDownload ? (
                      <Menu.Item
                        onClick={() => props.onDownload(item.id)}
                        className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-highlighted:bg-muted"
                      >
                        <Download aria-hidden="true" />
                        {m.downloadPng()}
                      </Menu.Item>
                    ) : null}
                    {item.canRetry ? (
                      <Menu.Item
                        onClick={() => {
                          const trigger = itemMenuTriggers.current[item.id];
                          if (trigger) props.onRetry(item.id, trigger);
                        }}
                        className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-highlighted:bg-muted"
                      >
                        <RefreshCw aria-hidden="true" />
                        {item.retryLabel}
                      </Menu.Item>
                    ) : null}
                    <div role="separator" className="my-1 h-px bg-border" />
                    <Menu.Item
                      onClick={() => {
                        const trigger = itemMenuTriggers.current[item.id];
                        if (trigger) props.onRemove(item.id, trigger);
                      }}
                      className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm text-destructive outline-none data-highlighted:bg-destructive/10"
                    >
                      <Trash2 aria-hidden="true" />
                      {m.removeImage()}
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </article>
        ))}
      </div>
    </section>
  );
}
