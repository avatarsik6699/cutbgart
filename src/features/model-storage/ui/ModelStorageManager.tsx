import { useEffect, useState } from "react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";
import {
  clearModelCache,
  getModelCacheStatus,
  type ModelCacheStatus,
} from "../model/model-cache";
import { ModelStorageDetails } from "./model-storage-details";
import { ModelStorageEmpty, ModelStorageLoading } from "./model-storage-states";

/** Content mounted only while the downloaded-model popover is open. */
export function ModelStorageManager() {
  const [status, setStatus] = useState<ModelCacheStatus | null>(null);
  const [busy, setBusy] = useState(true);
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

  const hasStatus = status !== null;

  return (
    <div
      data-testid="model-storage-manager"
      className="flex max-h-[min(32rem,70dvh)] flex-col gap-3 overflow-y-auto text-sm text-muted-foreground"
    >
      <p className="text-xs leading-relaxed">{m.modelStoragePrivacy()}</p>

      {busy && !hasStatus && <ModelStorageLoading />}
      {!busy && status?.assetCount === 0 && <ModelStorageEmpty />}
      {status && status.assetCount > 0 && <ModelStorageDetails status={status} />}
      {busy && hasStatus && <span className="sr-only">{m.modelStorageLoading()}</span>}

      {cleared && <p role="status">{m.modelStorageCleared()}</p>}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <p className="font-medium">{m.modelStorageError()}</p>
        </div>
      )}

      {error && !status ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void refresh()}
          className="self-start"
        >
          {m.tryAgain()}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={busy || !status || status.assetCount === 0}
          onClick={() => void clear()}
          className="self-start"
        >
          {m.modelStorageClear()}
        </Button>
      )}
    </div>
  );
}
