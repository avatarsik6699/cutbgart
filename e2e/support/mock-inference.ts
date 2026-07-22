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
      value: [] as Array<{
        type: string;
        qualityMode?: string;
        promptType?: string;
        revision?: number;
        pointLabels?: number[];
        requestedMode?: string;
      }>,
    });
    class MockInferenceWorker extends EventTarget {
      private source: {
        blob: Blob;
        width: number;
        height: number;
        format: string;
      } | null = null;
      private guidedPromptCount = 0;

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
        revision?: number;
        prompt?: {
          revision: number;
          points: Array<{ label: number }>;
          box: unknown;
        };
        request?: {
          requestId: string;
          requestedMode: "balanced" | "maximum";
          requestedPath: "webgpu" | "wasm";
          priorMatte: {
            width: number;
            height: number;
            data: Uint8ClampedArray;
          };
        };
      }): void {
        (
          window as unknown as {
            __mockInferencePosts: Array<{
              type: string;
              qualityMode?: string;
              promptType?: string;
              revision?: number;
              pointLabels?: number[];
              requestedMode?: string;
            }>;
          }
        ).__mockInferencePosts.push({
          type: message.type,
          qualityMode: message.qualityMode,
          promptType: message.prompt ? (message.prompt.box ? "box" : "point") : undefined,
          revision: message.revision ?? message.prompt?.revision,
          pointLabels: message.prompt?.points.map((point) => point.label),
          requestedMode: message.request?.requestedMode,
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
            this.emit({
              type: "status",
              revision: message.revision,
              status: "loading-model",
              progress: 50,
            });
            this.emit({
              type: "status",
              revision: message.revision,
              status: "encoding-image",
            });
            this.emit({
              type: "status",
              revision: message.revision,
              status: "ready-for-prompt",
            });
            return;
          }
          if (message.type === "prompt" && message.prompt && this.source) {
            this.guidedPromptCount += 1;
            const revision = message.prompt.revision;
            const source = this.source;
            const respond = () => {
              this.emit({ type: "status", revision, status: "predicting-mask" });
              this.emit({
                type: "candidates",
                revision,
                candidates: [0.92, 0.78, 0.61].map((score, index) => {
                  const pixelCount = source.width * source.height;
                  const differenceRatio = index * 0.2;
                  const data = new Uint8ClampedArray(pixelCount).fill(255);
                  data.fill(0, 0, Math.floor(pixelCount * differenceRatio));
                  return {
                    id: `mock-${String(revision)}-${String(index)}`,
                    score: (window as unknown as { __mockInvalidGuidedScores?: boolean })
                      .__mockInvalidGuidedScores
                      ? null
                      : score,
                    differenceRatio,
                    matte: { width: source.width, height: source.height, data },
                  };
                }),
              });
            };
            const delayFirst =
              (window as unknown as { __mockDelayFirstGuidedResponse?: boolean })
                .__mockDelayFirstGuidedResponse && this.guidedPromptCount === 1;
            if (delayFirst) window.setTimeout(respond, 250);
            else respond();
            return;
          }
          if (message.type === "dispose") {
            this.emit({
              type: "disposed",
              requestId: message.requestId,
              revision: message.revision,
            });
            return;
          }
          if (message.type === "refine" && message.request) {
            const request = message.request;
            const maximumFailure = Boolean(
              (window as unknown as { __mockMattingMaximumFailure?: boolean })
                .__mockMattingMaximumFailure,
            );
            const balancedFailure = Boolean(
              (window as unknown as { __mockMattingBalancedFailure?: boolean })
                .__mockMattingBalancedFailure,
            );
            this.emit({
              type: "progress",
              requestId: request.requestId,
              stage: "loading",
              percent: 50,
            });
            if (request.requestedMode === "maximum" && maximumFailure) {
              this.emit({
                type: "fallback",
                requestId: request.requestId,
                from: "maximum",
                to: "balanced",
                reason: "mock WebGPU failure",
              });
            }
            const deterministic = balancedFailure;
            this.emit({
              type: "result",
              requestId: request.requestId,
              result: {
                matte: {
                  ...request.priorMatte,
                  data: request.priorMatte.data.slice(),
                },
                requestedMode: request.requestedMode,
                actualMode: deterministic
                  ? "deterministic"
                  : request.requestedMode === "maximum" && maximumFailure
                    ? "balanced"
                    : request.requestedMode,
                actualPath: deterministic ? null : request.requestedPath,
                fallback: deterministic
                  ? "deterministic"
                  : request.requestedMode === "maximum" && maximumFailure
                    ? "balanced"
                    : "none",
              },
            });
            return;
          }
          if (message.type === "reset") return;
          if (message.type === "process" && message.source) {
            this.source = message.source;
            const emitResult = () => {
              const canvas = document.createElement("canvas");
              canvas.width = message.source!.width;
              canvas.height = message.source!.height;
              const context = canvas.getContext("2d")!;
              context.fillStyle = "#FFFFFF";
              context.fillRect(0, 0, canvas.width, canvas.height);
              canvas.toBlob((result) => {
                if (!result) {
                  this.emit({ type: "error", message: "Mock PNG encoding failed" });
                  return;
                }
                this.emit({
                  type: "process-result",
                  requestId: message.requestId,
                  result,
                  matte: (() => {
                    const data = new Uint8ClampedArray(
                      message.source!.width * message.source!.height,
                    ).fill(255);
                    data.fill(128, 0, Math.max(1, message.source!.width));
                    return {
                      width: message.source!.width,
                      height: message.source!.height,
                      data,
                    };
                  })(),
                  durationMs: 1,
                  actualMode:
                    message.qualityMode === "ben2-fp16" &&
                    ((window as unknown as { __mockBen2Failure?: boolean })
                      .__mockBen2Failure ||
                      message.inferencePath === "wasm")
                      ? "isnet-q8"
                      : message.qualityMode,
                });
              }, "image/png");
            };
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
