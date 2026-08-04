export type DownloadAdapter = {
  start(url: string, filename: string): void;
  startBlob?(blob: Blob, filename: string): void;
};

export function createNativeDownloadAdapter(): DownloadAdapter {
  function start(url: string, filename: string): void {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.click();
  }
  return {
    start,
    startBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      start(url, filename);
      queueMicrotask(() => URL.revokeObjectURL(url));
    },
  };
}
