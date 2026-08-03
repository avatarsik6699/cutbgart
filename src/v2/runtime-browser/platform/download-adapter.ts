export type DownloadAdapter = {
  start(url: string, filename: string): void;
};

export function createNativeDownloadAdapter(): DownloadAdapter {
  return {
    start(url, filename) {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      anchor.click();
    },
  };
}
