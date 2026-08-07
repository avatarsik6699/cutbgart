import {
  collectResourceSamples,
  detectPerformanceSupport,
  observeLongTasks,
  type BrowserPerformanceSource,
} from "./browser-probes";
import type { PerformanceScenarioAdapter } from "./orchestrator";
import type {
  ArtifactSample,
  InteractionSample,
  LongTaskSample,
  PerformanceReportV1,
} from "./report";

export type BrowserPerformanceCollectorOptions = {
  environment: PerformanceReportV1["environment"];
  source?: BrowserPerformanceSource | null;
  nowIso?: () => string;
  observe?: boolean;
};

export class BrowserPerformanceCollector implements PerformanceScenarioAdapter {
  readonly #environment: PerformanceReportV1["environment"];
  readonly #source: BrowserPerformanceSource | null | undefined;
  readonly #nowIso: () => string;
  readonly #support: PerformanceReportV1["support"];
  readonly #interactions: InteractionSample[] = [];
  readonly #longTasks: LongTaskSample[] = [];
  readonly #artifacts: ArtifactSample[] = [];
  readonly #limitations: string[] = [];
  readonly #disconnect: () => void;

  constructor(options: BrowserPerformanceCollectorOptions) {
    this.#environment = structuredClone(options.environment);
    this.#source = options.source;
    this.#nowIso = options.nowIso ?? (() => new Date().toISOString());
    this.#support = detectPerformanceSupport(options.source);
    if (options.observe === false) {
      this.#disconnect = () => undefined;
    } else {
      const observer = observeLongTasks((sample) => this.#longTasks.push(sample));
      this.#support.longTasks = observer.support;
      this.#disconnect = () => observer.disconnect();
    }
  }

  recordInteraction(sample: InteractionSample): void {
    if (sample.eventToNextPaintMs === null && !sample.missed) {
      throw new Error("A missing interaction duration must be marked as a missed action");
    }
    this.#interactions.push({ ...sample });
  }

  recordArtifact(sample: ArtifactSample): void {
    this.#artifacts.push({ ...sample });
  }

  addLimitation(limitation: string): void {
    this.#limitations.push(limitation);
  }

  disconnect(): void {
    this.#disconnect();
  }

  nowIso() {
    return this.#nowIso();
  }
  environment() {
    return structuredClone(this.#environment);
  }
  support() {
    return structuredClone(this.#support);
  }
  interactions() {
    return structuredClone(this.#interactions);
  }
  longTasks() {
    return structuredClone(this.#longTasks);
  }
  resources() {
    return collectResourceSamples(this.#source).samples;
  }
  artifacts() {
    return structuredClone(this.#artifacts);
  }
  limitations() {
    return [...this.#limitations];
  }
}
