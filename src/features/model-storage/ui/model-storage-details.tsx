import { Cpu, Gauge, Sparkles, WandSparkles } from "lucide-react";
import type { ReactNode } from "react";

import { m } from "@/paraglide/messages";
import {
  groupModelCacheAssets,
  type ModelCacheGroupId,
} from "../model/model-cache-groups";
import { formatStorageBytes, type ModelCacheStatus } from "../model/model-cache";

function groupCopy(id: ModelCacheGroupId): Readonly<{
  code: string;
  description: string;
  icon: ReactNode;
  label: string;
}> {
  switch (id) {
    case "fast":
      return {
        code: "FAST",
        description: m.modelStorageFastDescription(),
        icon: <Gauge aria-hidden="true" />,
        label: m.processingModeFast(),
      };
    case "optimal":
      return {
        code: "OPT",
        description: m.modelStorageOptimalDescription(),
        icon: <Sparkles aria-hidden="true" />,
        label: m.processingModePrecise(),
      };
    case "maximum":
      return {
        code: "MAX",
        description: m.modelStorageMaximumDescription(),
        icon: <Sparkles aria-hidden="true" />,
        label: m.processingModeBen2(),
      };
    case "enhancements":
      return {
        code: "EDGE",
        description: m.modelStorageEnhancementsDescription(),
        icon: <Sparkles aria-hidden="true" />,
        label: m.modelStorageEnhancements(),
      };
    case "magic":
      return {
        code: "MAGIC",
        description: m.modelStorageMagicDescription(),
        icon: <WandSparkles aria-hidden="true" />,
        label: m.modelStorageMagic(),
      };
  }
}

export function ModelStorageDetails(props: { status: ModelCacheStatus }) {
  const groups = groupModelCacheAssets(props.status.cachedAssets);

  return (
    <div className="grid gap-3" data-testid="model-storage-details">
      <div className="flex items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <p
            className="font-mono text-lg font-semibold text-foreground"
            data-testid="model-storage-usage"
          >
            {formatStorageBytes(props.status.usageBytes)}
          </p>
          <p className="text-xs">
            {m.modelStorageFiles({ count: String(props.status.assetCount) })}
          </p>
        </div>
        <span className="rounded-md border border-border bg-muted/30 px-2 py-1 font-mono text-[0.6875rem] text-muted-foreground">
          {props.status.release}
        </span>
      </div>

      {groups.models.length > 0 && (
        <ul className="grid gap-1.5" aria-label={m.modelStorageDownloadedModels()}>
          {groups.models.map((group) => {
            const copy = groupCopy(group.id);
            return (
              <li
                key={group.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-border bg-muted/20 p-2.5"
              >
                <span className="grid size-8 place-items-center rounded-md border border-border bg-background text-muted-foreground [&_svg]:size-4">
                  {copy.icon}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-foreground">{copy.label}</span>
                    <span className="font-mono text-[0.625rem] tracking-wider text-muted-foreground">
                      {copy.code}
                    </span>
                  </span>
                  <span className="block text-xs leading-snug">{copy.description}</span>
                </span>
                <span className="text-right font-mono text-xs text-foreground">
                  {formatStorageBytes(group.byteSize)}
                  <span className="block text-[0.625rem] text-muted-foreground">
                    {m.modelStorageFiles({ count: String(group.assetCount) })}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {groups.runtime && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-2.5 py-2 text-xs">
          <span className="flex items-center gap-2">
            <Cpu className="size-3.5" aria-hidden="true" />
            {m.modelStorageRuntime()}
            {groups.runtime.version && (
              <span className="font-mono text-[0.625rem] text-muted-foreground">
                v{groups.runtime.version}
              </span>
            )}
          </span>
          <span className="font-mono text-foreground">
            {formatStorageBytes(groups.runtime.byteSize)}
          </span>
        </div>
      )}
    </div>
  );
}
