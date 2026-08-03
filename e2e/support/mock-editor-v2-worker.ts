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
      };
      type TestWindow = Window & {
        __completeV2Run?: () => void;
        __advanceV2RunStage?: (
          stage: "model-loading" | "automatic-remove",
          fraction: number,
        ) => void;
        __v2RunCount?: number;
      };

      const testWindow = window as TestWindow;
      class MockEditorWorker extends EventTarget {
        active: RunCommand | null = null;

        postMessage(
          command:
            | RunCommand
            | { protocol: 1; type: string; correlation?: RunCommand["correlation"] },
        ): void {
          if (command.type === "RUN") {
            this.active = command as RunCommand;
            testWindow.__completeV2Run = () => this.complete();
            testWindow.__advanceV2RunStage = (stage, fraction) =>
              this.progress(stage, fraction);
            testWindow.__v2RunCount = (testWindow.__v2RunCount ?? 0) + 1;
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
          if (command.type === "CANCEL" && this.active !== null) {
            const correlation = this.active.correlation;
            this.active = null;
            this.emit({ protocol: 1, type: "CANCELLED", correlation, timings: [] });
            return;
          }
          if (command.type === "DISPOSE_RUNTIME") {
            this.emit({ protocol: 1, type: "DISPOSED" });
          }
        }

        terminate(): void {
          this.active = null;
        }

        complete(): void {
          const command = this.active;
          if (command === null) {
            throw new Error("No active editor v2 run");
          }
          this.active = null;
          const png = Uint8Array.from([
            137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
            0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 215,
            99, 248, 207, 192, 240, 31, 0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73,
            69, 78, 68, 174, 66, 96, 130,
          ]);
          this.emit({
            protocol: 1,
            type: "SUCCEEDED",
            correlation: command.correlation,
            outputs: {
              matte: new Uint8Array([255]).buffer,
              compositePng: png.buffer,
              width: 1,
              height: 1,
            },
            timings: [],
          });
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
      };
      delete testWindow.__completeV2Run;
      delete testWindow.__advanceV2RunStage;
      delete testWindow.__v2RunCount;
    })
    .catch(() => undefined);
}
