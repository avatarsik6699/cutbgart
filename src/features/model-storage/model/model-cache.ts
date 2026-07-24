export interface ModelCacheStatus {
  release: string;
  assetCount: number;
  usageBytes: number;
  quotaBytes: number | null;
  totalOriginUsageBytes: number | null;
}

type WorkerReply =
  | ({ type: "MODEL_CACHE_STATUS" } & ModelCacheStatus)
  | { type: "MODEL_CACHE_CLEARED" }
  | { type: "MODEL_CACHE_ERROR"; code: string; message?: string };

async function requestServiceWorker(
  type: "GET_MODEL_CACHE_STATUS" | "CLEAR_MODEL_CACHE",
): Promise<WorkerReply> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Model storage management is unavailable in this browser");
  }
  const registration = await navigator.serviceWorker.ready;
  const worker = navigator.serviceWorker.controller ?? registration.active;
  if (!worker) throw new Error("Model storage worker is not active yet");

  return new Promise<WorkerReply>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error("Model storage worker did not respond"));
    }, 5_000);
    channel.port1.onmessage = (event: MessageEvent<WorkerReply>) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      if (event.data.type === "MODEL_CACHE_ERROR") {
        reject(new Error(event.data.message ?? event.data.code));
      } else {
        resolve(event.data);
      }
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}

export async function getModelCacheStatus(): Promise<ModelCacheStatus> {
  const reply = await requestServiceWorker("GET_MODEL_CACHE_STATUS");
  if (reply.type !== "MODEL_CACHE_STATUS") {
    throw new Error("Unexpected model storage response");
  }
  return reply;
}

export async function clearModelCache(): Promise<void> {
  const reply = await requestServiceWorker("CLEAR_MODEL_CACHE");
  if (reply.type !== "MODEL_CACHE_CLEARED") {
    throw new Error("Unexpected model storage response");
  }
}

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
