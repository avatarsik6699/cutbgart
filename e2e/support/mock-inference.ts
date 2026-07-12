import type { Page } from "@playwright/test";

/**
 * Replaces only the ML worker boundary. Browser rendering, uploads, state
 * transitions, canvas correction, downloads, and responsive layouts remain
 * real. The external model/CDN path is covered separately by real-model.spec.
 */
export async function installMockInference(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Keep transitional queue/processing UI observable while remaining much
    // faster than real model inference.
    const PROCESS_DELAY_MS = 800;
    class MockInferenceWorker extends EventTarget {
      private source: {
        blob: Blob;
        width: number;
        height: number;
        format: string;
      } | null = null;

      postMessage(message: {
        type: string;
        requestId?: string;
        qualityMode?: string;
        inferencePath?: string;
        source?: { blob: Blob; width: number; height: number; format: string };
        image?: {
          source: { blob: Blob; width: number; height: number; format: string };
          result: Blob;
          qualityMode: string;
        };
        matte?: { data: Uint8ClampedArray };
      }): void {
        queueMicrotask(() => {
          if (message.type === "load-model") {
            this.emit({
              type: "model-progress",
              qualityMode: message.qualityMode,
              percent: 50,
              loaded: 5_242_880,
              total: 10_485_760,
            });
            this.emit({
              type: "model-ready",
              qualityMode: message.qualityMode,
              inferencePath: message.inferencePath ?? "wasm",
              dtype: "e2e-mock",
            });
            return;
          }
          if (message.type === "process" && message.source) {
            this.source = message.source;
            const emitResult = () =>
              this.emit({
                type: "process-result",
                requestId: message.requestId,
                result: message.source?.blob,
                durationMs: 1,
              });
            window.setTimeout(emitResult, PROCESS_DELAY_MS);
            return;
          }
          if (message.type === "extract-alpha-matte" && this.source) {
            this.emit({
              type: "alpha-matte-result",
              requestId: message.requestId,
              matte: {
                width: this.source.width,
                height: this.source.height,
                data: new Uint8ClampedArray(this.source.width * this.source.height).fill(
                  255,
                ),
              },
              durationMs: 1,
            });
            return;
          }
          if (message.type === "recomposite" && message.image && message.matte) {
            // Trailing bytes keep the uploaded image decodable while making
            // the corrected download observably different from the original.
            const result = new Blob(
              [message.image.source.blob, message.matte.data.slice(0, 64)],
              { type: "image/png" },
            );
            this.emit({
              type: "recomposite-result",
              requestId: message.requestId,
              result: { ...message.image, result },
              durationMs: 1,
            });
          }
        });
      }

      terminate(): void {
        // No resources are held by this deterministic in-page worker.
      }

      private emit(data: unknown): void {
        this.dispatchEvent(new MessageEvent("message", { data }));
      }
    }

    Object.defineProperty(window, "Worker", {
      value: MockInferenceWorker,
      configurable: true,
    });
  });
}
