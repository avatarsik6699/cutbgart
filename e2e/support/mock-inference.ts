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
    Object.defineProperty(window, "__mockInferencePosts", {
      configurable: true,
      value: [] as Array<{ type: string; qualityMode?: string; promptType?: string }>,
    });
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
          cutout?: Blob;
          qualityMode: string;
          backgroundFill?: unknown;
        };
        matte?: { data: Uint8ClampedArray };
        backgroundFill?: unknown;
      }): void {
        (
          window as unknown as {
            __mockInferencePosts: Array<{
              type: string;
              qualityMode?: string;
              promptType?: string;
            }>;
          }
        ).__mockInferencePosts.push({
          type: message.type,
          qualityMode: message.qualityMode,
          promptType: (message as { prompt?: { type?: string } }).prompt?.type,
        });
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- one async mock-worker turn; failures become worker error messages below.
        queueMicrotask(async () => {
          if (message.type === "load-model") {
            const ben2Fallback =
              message.qualityMode === "ben2-fp16" &&
              ((window as unknown as { __mockBen2Failure?: boolean }).__mockBen2Failure ||
                message.inferencePath === "wasm");
            this.emit({
              type: "model-progress",
              qualityMode: message.qualityMode,
              percent: 50,
              loaded: 5_242_880,
              total: 10_485_760,
            });
            if (ben2Fallback) {
              this.emit({
                type: "fallback-to-isnet",
                qualityMode: message.qualityMode,
                reason: (window as unknown as { __mockBen2Failure?: boolean })
                  .__mockBen2Failure
                  ? "device-out-of-memory"
                  : "webgpu-unavailable",
              });
            }
            this.emit({
              type: "model-ready",
              qualityMode: message.qualityMode,
              inferencePath: message.inferencePath ?? "wasm",
              dtype: "e2e-mock",
            });
            return;
          }
          if (message.type === "encode" && message.source) {
            if (
              (window as unknown as { __mockGuidedWorkerCrash?: boolean })
                .__mockGuidedWorkerCrash
            ) {
              this.dispatchEvent(
                new ErrorEvent("error", {
                  message: "Guided worker failed to load",
                  cancelable: true,
                }),
              );
              return;
            }
            this.source = message.source;
            this.emit({ type: "status", status: "loading-model", progress: 50 });
            this.emit({ type: "status", status: "encoding-image" });
            this.emit({ type: "status", status: "ready-for-prompt" });
            return;
          }
          if (message.type === "prompt" && this.source) {
            this.emit({ type: "status", status: "predicting-mask" });
            this.emit({
              type: "preview",
              matte: {
                width: this.source.width,
                height: this.source.height,
                data: new Uint8ClampedArray(this.source.width * this.source.height).fill(
                  255,
                ),
              },
            });
            return;
          }
          if (message.type === "reset") return;
          if (message.type === "process" && message.source) {
            this.source = message.source;
            const emitResult = () =>
              this.emit({
                type: "process-result",
                requestId: message.requestId,
                result: message.source?.blob,
                matte: {
                  width: message.source!.width,
                  height: message.source!.height,
                  data: new Uint8ClampedArray(
                    message.source!.width * message.source!.height,
                  ).fill(255),
                },
                durationMs: 1,
                actualMode:
                  message.qualityMode === "ben2-fp16" &&
                  ((window as unknown as { __mockBen2Failure?: boolean })
                    .__mockBen2Failure ||
                    message.inferencePath === "wasm")
                    ? "isnet-q8"
                    : message.qualityMode,
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
            try {
              // Trailing bytes keep the uploaded image decodable while making
              // the corrected download observably different from the original.
              const canvas = document.createElement("canvas");
              canvas.width = message.image.source.width;
              canvas.height = message.image.source.height;
              const context = canvas.getContext("2d")!;
              if (message.backgroundFill && typeof message.backgroundFill === "object") {
                const fill = message.backgroundFill as {
                  type?: string;
                  value?: string;
                  blob?: Blob;
                  stops?: { color: string }[];
                };
                if (fill.type === "color") {
                  context.fillStyle = fill.value!;
                  context.fillRect(0, 0, canvas.width, canvas.height);
                } else if (fill.type === "gradient") {
                  const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
                  gradient.addColorStop(0, fill.stops![0]!.color);
                  gradient.addColorStop(1, fill.stops![1]!.color);
                  context.fillStyle = gradient;
                  context.fillRect(0, 0, canvas.width, canvas.height);
                } else if (fill.type === "image" && fill.blob) {
                  context.fillStyle = "#22C55E";
                  context.fillRect(0, 0, canvas.width, canvas.height);
                }
              }
              context.fillStyle = "#FFFFFF";
              context.fillRect(
                canvas.width / 4,
                canvas.height / 4,
                canvas.width / 2,
                canvas.height / 2,
              );
              const result = await new Promise<Blob>((resolve, reject) =>
                canvas.toBlob(
                  (blob) =>
                    blob ? resolve(blob) : reject(new Error("Mock PNG encoding failed")),
                  "image/png",
                ),
              );
              this.emit({
                type: "recomposite-result",
                requestId: message.requestId,
                result: {
                  ...message.image,
                  result,
                  cutout: message.image.cutout ?? message.image.result,
                  alphaMatte: message.matte,
                  backgroundFill: message.backgroundFill ?? message.image.backgroundFill,
                  backgroundPending: false,
                },
                durationMs: 1,
              });
            } catch (error) {
              this.emit({
                type: "error",
                requestId: message.requestId,
                code: "compositing-failed",
                message: error instanceof Error ? error.message : String(error),
              });
            }
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
