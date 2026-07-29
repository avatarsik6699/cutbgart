import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import {
  clearModelCache,
  formatStorageBytes,
  getModelCacheStatus,
  type ModelCacheStatus,
} from "../model/model-cache";

/**
 * Popover content for the model-storage trigger in `site-header` (Phase 30
 * `T6`). Mounted only while the popover is open (Base UI `Popover.Portal`
 * doesn't render its content while closed), so the mount-time effect below
 * replaces the previous `<details onToggle>` "load on first expand" behavior.
 */
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

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refresh(), 0);
    // Load once per mount (i.e. once per popover open) — not on every
    // `refresh` identity change.
    return () => window.clearTimeout(refreshTimer);
  }, []);

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
    <div
      data-testid="model-storage-manager"
      className="flex max-w-xs flex-col gap-3 text-sm text-muted-foreground"
    >
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
  );
}
