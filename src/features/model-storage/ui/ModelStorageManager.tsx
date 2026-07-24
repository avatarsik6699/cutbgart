import { useState } from "react";
import { Database, Trash2 } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import {
  clearModelCache,
  formatStorageBytes,
  getModelCacheStatus,
  type ModelCacheStatus,
} from "../model/model-cache";

export function ModelStorageManager() {
  const [status, setStatus] = useState<ModelCacheStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await getModelCacheStatus());
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : String(refreshError),
      );
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    setCleared(false);
    try {
      await clearModelCache();
      setStatus(await getModelCacheStatus());
      setCleared(true);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : String(clearError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details
      data-testid="model-storage-manager"
      className="rounded-lg border border-border bg-background p-3 text-sm"
      onToggle={(event) => {
        if (event.currentTarget.open && !status && !busy) void refresh();
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Database className="size-4" aria-hidden="true" />
        {m.modelStorageTitle()}
      </summary>
      <div className="mt-3 flex max-w-md flex-col gap-3 text-muted-foreground">
        <p>{m.modelStoragePrivacy()}</p>
        {busy && <p role="status">{m.modelStorageLoading()}</p>}
        {status && !busy && (
          <p data-testid="model-storage-usage" aria-live="polite">
            {m.modelStorageUsage({
              usage: formatStorageBytes(status.usageBytes),
              count: String(status.assetCount),
            })}
          </p>
        )}
        {cleared && <p role="status">{m.modelStorageCleared()}</p>}
        {error && (
          <p role="alert" className="text-destructive">
            {m.modelStorageError()}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={busy || !status || status.assetCount === 0}
          onClick={() => void clear()}
          className="self-start"
        >
          <Trash2 aria-hidden="true" />
          {m.modelStorageClear()}
        </Button>
      </div>
    </details>
  );
}
