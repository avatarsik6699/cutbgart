import type { Page } from "@playwright/test";

export async function installMockEditorV2Worker(
  page: Page,
  options: { manualStages?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ({ manualStages }) => {
      type RunCommand = {
        protocol: 1;
        type: "RUN";
        correlation: { documentId: string; runId: string; expectedRevision: number };
        model?: { mode?: string };
        source?: { height: number; width: number };
      };
      type WorkerCommand = {
        protocol: number;
        type: string;
        correlation?: Record<string, unknown>;
        bytes?: ArrayBuffer;
        mediaType?: string;
        matte?: ArrayBuffer;
        blob?: Blob;
        height?: number;
        width?: number;
      };
      type TestWindow = Window & {
        __completeV2Run?: () => void;
        __advanceV2RunStage?: (
          stage: "model-loading" | "automatic-remove",
          fraction: number,
        ) => void;
        __v2RunCount?: number;
        __v2RunModelModes?: string[];
        __v2ManualCommitCount?: number;
        __v2MagicCommitCount?: number;
        __v2MagicPredictionCount?: number;
        __v2BackgroundCommitCount?: number;
        __v2BackgroundPreparationCount?: number;
        __v2EnhancementCommitCount?: number;
        __v2EnhancementRunCount?: number;
        __completeV2Enhancement?: () => void;
        __v2EnhancementOutcome?: "changed" | "unchanged" | "failed";
      };

      const testWindow = window as TestWindow;
      const workers = new Set<MockEditorWorker>();
      class MockEditorWorker extends EventTarget {
        active: RunCommand | null = null;

        constructor() {
          super();
          workers.add(this);
        }

        postMessage(command: WorkerCommand): void {
          if (
            command.type === "RESIZE_EXPORT" &&
            command.blob !== undefined &&
            command.width !== undefined &&
            command.height !== undefined
          ) {
            void createImageBitmap(command.blob).then(async (bitmap) => {
              try {
                const canvas = new OffscreenCanvas(command.width!, command.height!);
                const context = canvas.getContext("2d")!;
                context.drawImage(bitmap, 0, 0, command.width!, command.height!);
                const blob = await canvas.convertToBlob({ type: "image/png" });
                this.emit({ type: "RESIZED", blob });
              } finally {
                bitmap.close();
              }
            });
            return;
          }
          if (command.type === "RUN" && command.correlation?.operationId !== undefined) {
            const operationId = command.correlation.operationId;
            const correlation = command.correlation;
            testWindow.__v2EnhancementRunCount =
              (testWindow.__v2EnhancementRunCount ?? 0) + 1;
            const complete = (): void => {
              if (testWindow.__completeV2Enhancement !== complete) return;
              delete testWindow.__completeV2Enhancement;
              const outcome = testWindow.__v2EnhancementOutcome ?? "changed";
              if (outcome === "failed") {
                this.emit({
                  protocol: command.protocol,
                  type: "FAILED",
                  correlation,
                  error: {
                    code: "processing-failed",
                    message: "Mock enhancement failure",
                    retryable: true,
                  },
                });
                return;
              }
              const matte = new Uint8Array(command.matte ?? new ArrayBuffer(1));
              const changedMatte = matte.slice();
              if (outcome === "changed")
                changedMatte[0] = Math.max(0, (changedMatte[0] ?? 255) - 1);
              this.emit({
                protocol: command.protocol,
                type: "SUCCEEDED",
                correlation,
                output:
                  operationId === "fine-detail"
                    ? {
                        operationId,
                        matte: changedMatte.buffer,
                        changed: outcome === "changed",
                        actualMode: "deterministic",
                        actualPath: null,
                        fallback: "deterministic",
                      }
                    : {
                        operationId,
                        matte: changedMatte.buffer,
                        foregroundPng: outcome === "changed" ? this.png().buffer : null,
                        changed: outcome === "changed",
                        actualPath:
                          outcome === "changed" ? "edge-aware-fallback" : "unchanged",
                        fallback:
                          outcome === "changed" ? "none" : "no-background-samples",
                      },
              });
            };
            testWindow.__completeV2Enhancement = complete;
            queueMicrotask(() => {
              this.emit({ protocol: command.protocol, type: "ACCEPTED", correlation });
              this.emit({
                protocol: command.protocol,
                type: "PROGRESS",
                correlation,
                stage:
                  operationId === "fine-detail"
                    ? "enhancement-fine-detail"
                    : "enhancement-colour-halo",
                fraction: 0.5,
              });
            });
            return;
          }
          if (command.type === "RUN") {
            this.active = command as RunCommand;
            testWindow.__completeV2Run = () => {
              const activeWorker = [...workers].find((worker) => worker.active !== null);
              if (activeWorker === undefined) throw new Error("No active editor v2 run");
              activeWorker.complete();
            };
            testWindow.__advanceV2RunStage = (stage, fraction) => {
              const activeWorker = [...workers].find((worker) => worker.active !== null);
              if (activeWorker === undefined) throw new Error("No active editor v2 run");
              activeWorker.progress(stage, fraction);
            };
            testWindow.__v2RunCount = (testWindow.__v2RunCount ?? 0) + 1;
            testWindow.__v2RunModelModes = [
              ...(testWindow.__v2RunModelModes ?? []),
              (command as RunCommand).model?.mode ?? "unknown",
            ];
            this.emit({
              protocol: 1,
              type: "ACCEPTED",
              correlation: this.active.correlation,
            });
            if (!manualStages) {
              queueMicrotask(() => {
                this.progress("model-loading", 1);
                this.progress("automatic-remove", 0.5);
              });
            }
            return;
          }
          if (
            command.type === "PREPARE_BACKGROUND_IMAGE" &&
            command.correlation !== undefined &&
            command.bytes !== undefined &&
            (command.mediaType === "image/png" ||
              command.mediaType === "image/jpeg" ||
              command.mediaType === "image/webp")
          ) {
            testWindow.__v2BackgroundPreparationCount =
              (testWindow.__v2BackgroundPreparationCount ?? 0) + 1;
            const correlation = command.correlation;
            queueMicrotask(() =>
              this.emit({
                protocol: command.protocol,
                type: "SUCCEEDED",
                correlation,
                bytes: command.bytes,
                mediaType: command.mediaType,
                width: 1,
                height: 1,
              }),
            );
            return;
          }
          if (command.type === "PREDICT" && command.correlation !== undefined) {
            testWindow.__v2MagicPredictionCount =
              (testWindow.__v2MagicPredictionCount ?? 0) + 1;
            const correlation = command.correlation;
            queueMicrotask(() => {
              this.emit({
                protocol: command.protocol,
                type: "PROGRESS",
                correlation,
                stage: "magic-encode",
                fraction: null,
              });
              this.emit({
                protocol: command.protocol,
                type: "PROGRESS",
                correlation,
                stage: "magic-predict",
                fraction: null,
              });
              this.emit({
                protocol: command.protocol,
                type: "SUCCEEDED",
                correlation,
                candidates: [
                  {
                    data: new Uint8Array([255]).buffer,
                    width: 1,
                    height: 1,
                    score: 0.9,
                  },
                ],
              });
            });
            return;
          }
          if (
            command.type === "MATERIALIZE_SNAPSHOT" &&
            command.correlation !== undefined
          ) {
            if (
              "operation" in command.correlation &&
              command.correlation.operation === "magic-cutout"
            ) {
              testWindow.__v2MagicCommitCount =
                (testWindow.__v2MagicCommitCount ?? 0) + 1;
            } else {
              if (
                "operation" in command.correlation &&
                command.correlation.operation === "background"
              ) {
                testWindow.__v2BackgroundCommitCount =
                  (testWindow.__v2BackgroundCommitCount ?? 0) + 1;
              } else if (
                "operation" in command.correlation &&
                command.correlation.operation === "enhancement"
              ) {
                testWindow.__v2EnhancementCommitCount =
                  (testWindow.__v2EnhancementCommitCount ?? 0) + 1;
              } else {
                testWindow.__v2ManualCommitCount =
                  (testWindow.__v2ManualCommitCount ?? 0) + 1;
              }
            }
            const png = Uint8Array.from([
              137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
              0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8,
              215, 99, 96, 96, 96, 0, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69,
              78, 68, 174, 66, 96, 130,
            ]);
            queueMicrotask(() =>
              this.emit({
                protocol: command.protocol,
                type: "SUCCEEDED",
                correlation: command.correlation,
                compositePng: png.buffer,
              }),
            );
            return;
          }
          if (command.type === "CANCEL" && this.active !== null) {
            const correlation = this.active.correlation;
            this.active = null;
            this.emit({ protocol: 1, type: "CANCELLED", correlation, timings: [] });
            return;
          }
          if (command.type === "DISPOSE_RUNTIME") {
            this.emit({ protocol: command.protocol, type: "DISPOSED" });
          }
        }

        terminate(): void {
          this.active = null;
          workers.delete(this);
        }

        complete(): void {
          const command = this.active;
          if (command === null) {
            throw new Error("No active editor v2 run");
          }
          this.active = null;
          const width = command.source?.width ?? 1;
          const height = command.source?.height ?? 1;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d")!;
          context.fillStyle = "#FFFFFF";
          context.fillRect(0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob === null) throw new Error("Could not encode mock v2 result");
            void blob.arrayBuffer().then((compositePng) =>
              this.emit({
                protocol: 1,
                type: "SUCCEEDED",
                correlation: command.correlation,
                outputs: {
                  matte: new Uint8Array(width * height).fill(255).buffer,
                  compositePng,
                  width,
                  height,
                },
                timings: [],
              }),
            );
          }, "image/png");
        }

        png(): Uint8Array {
          return Uint8Array.from([
            137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
            0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 215,
            99, 96, 96, 96, 0, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68,
            174, 66, 96, 130,
          ]);
        }

        progress(stage: "model-loading" | "automatic-remove", fraction: number): void {
          if (this.active === null) throw new Error("No active editor v2 run");
          this.emit({
            protocol: 1,
            type: "PROGRESS",
            correlation: this.active.correlation,
            stage,
            fraction,
            timing:
              stage === "model-loading"
                ? { stage: "model-loading", durationMs: 1 }
                : null,
          });
        }

        emit(data: unknown): void {
          this.dispatchEvent(new MessageEvent("message", { data }));
        }
      }

      Object.defineProperty(window, "Worker", {
        configurable: true,
        value: MockEditorWorker,
      });
    },
    { manualStages: options.manualStages ?? true },
  );
}

export async function advanceMockEditorV2Stage(
  page: Page,
  stage: "model-loading" | "automatic-remove",
  fraction = 0.5,
): Promise<void> {
  await page.evaluate(
    ({ nextFraction, nextStage }) => {
      const advance = (
        window as Window & {
          __advanceV2RunStage?: (
            stage: "model-loading" | "automatic-remove",
            fraction: number,
          ) => void;
        }
      ).__advanceV2RunStage;
      if (advance === undefined)
        throw new Error("Mock editor v2 worker is not installed");
      advance(nextStage, nextFraction);
    },
    { nextFraction: fraction, nextStage: stage },
  );
}

export async function completeMockEditorV2Run(page: Page): Promise<void> {
  await page.evaluate(() => {
    const complete = (window as Window & { __completeV2Run?: () => void })
      .__completeV2Run;
    if (complete === undefined) throw new Error("Mock editor v2 worker is not installed");
    complete();
  });
}

export async function mockEditorV2RunCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as Window & { __v2RunCount?: number }).__v2RunCount ?? 0,
  );
}

export async function mockEditorV2ManualCommitCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as Window & { __v2ManualCommitCount?: number }).__v2ManualCommitCount ?? 0,
  );
}

export async function mockEditorV2MagicPredictionCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as Window & { __v2MagicPredictionCount?: number })
        .__v2MagicPredictionCount ?? 0,
  );
}

export async function mockEditorV2MagicCommitCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as Window & { __v2MagicCommitCount?: number }).__v2MagicCommitCount ?? 0,
  );
}

export async function mockEditorV2BackgroundCommitCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as Window & { __v2BackgroundCommitCount?: number })
        .__v2BackgroundCommitCount ?? 0,
  );
}

export async function mockEditorV2BackgroundPreparationCount(
  page: Page,
): Promise<number> {
  return page.evaluate(
    () =>
      (window as Window & { __v2BackgroundPreparationCount?: number })
        .__v2BackgroundPreparationCount ?? 0,
  );
}

export async function mockEditorV2EnhancementCommitCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as Window & { __v2EnhancementCommitCount?: number })
        .__v2EnhancementCommitCount ?? 0,
  );
}

export async function mockEditorV2EnhancementRunCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as Window & { __v2EnhancementRunCount?: number }).__v2EnhancementRunCount ??
      0,
  );
}

export async function completeMockEditorV2Enhancement(page: Page): Promise<void> {
  await page.evaluate(() => {
    const complete = (window as Window & { __completeV2Enhancement?: () => void })
      .__completeV2Enhancement;
    if (complete === undefined) throw new Error("No active mock Enhancement stage");
    complete();
  });
}

export async function setMockEditorV2EnhancementOutcome(
  page: Page,
  outcome: "changed" | "unchanged" | "failed",
): Promise<void> {
  await page.evaluate((value) => {
    (
      window as Window & {
        __v2EnhancementOutcome?: "changed" | "unchanged" | "failed";
      }
    ).__v2EnhancementOutcome = value;
  }, outcome);
}

export async function resetMockEditorV2Worker(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const testWindow = window as Window & {
        __completeV2Run?: () => void;
        __advanceV2RunStage?: (
          stage: "model-loading" | "automatic-remove",
          fraction: number,
        ) => void;
        __v2RunCount?: number;
        __v2ManualCommitCount?: number;
        __v2MagicCommitCount?: number;
        __v2MagicPredictionCount?: number;
        __v2BackgroundCommitCount?: number;
        __v2BackgroundPreparationCount?: number;
        __v2EnhancementCommitCount?: number;
        __v2EnhancementRunCount?: number;
        __completeV2Enhancement?: () => void;
        __v2EnhancementOutcome?: "changed" | "unchanged" | "failed";
      };
      delete testWindow.__completeV2Run;
      delete testWindow.__advanceV2RunStage;
      delete testWindow.__v2RunCount;
      delete testWindow.__v2ManualCommitCount;
      delete testWindow.__v2MagicCommitCount;
      delete testWindow.__v2MagicPredictionCount;
      delete testWindow.__v2BackgroundCommitCount;
      delete testWindow.__v2BackgroundPreparationCount;
      delete testWindow.__v2EnhancementCommitCount;
      delete testWindow.__v2EnhancementRunCount;
      delete testWindow.__completeV2Enhancement;
      delete testWindow.__v2EnhancementOutcome;
    })
    .catch(() => undefined);
}
