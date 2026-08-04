export function createNativeExportWorker(): Worker {
  return new Worker(new URL("./export-resize.worker.ts", import.meta.url), {
    type: "module",
  });
}
