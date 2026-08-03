import type {
  LongTaskSample,
  MetricSupport,
  PerformanceSupport,
  ResourceSample,
} from "./report";

export type BrowserPerformanceSource = {
  supportedEntryTypes: readonly string[];
  resources(): readonly PerformanceResourceTiming[];
};

function nativeSource(): BrowserPerformanceSource | null {
  if (typeof PerformanceObserver === "undefined" || typeof performance === "undefined") {
    return null;
  }
  return {
    supportedEntryTypes: PerformanceObserver.supportedEntryTypes,
    resources: () =>
      performance.getEntriesByType("resource") as PerformanceResourceTiming[],
  };
}

export function detectPerformanceSupport(
  source: BrowserPerformanceSource | null = nativeSource(),
): PerformanceSupport {
  if (!source) {
    return {
      userTiming: "unsupported",
      longTasks: "unsupported",
      eventTiming: "unsupported",
      resources: "unsupported",
    };
  }
  const entrySupport = (name: string): MetricSupport =>
    source.supportedEntryTypes.includes(name) ? "supported" : "unsupported";
  return {
    userTiming: typeof performance.mark === "function" ? "supported" : "unsupported",
    longTasks: entrySupport("longtask"),
    eventTiming: entrySupport("event"),
    resources: entrySupport("resource"),
  };
}

function resourceKind(name: string, initiatorType: string): ResourceSample["kind"] {
  if (/model|\.onnx(?:\?|$)|huggingface|cdn\.cutbg\.art/i.test(name)) return "model";
  if (initiatorType === "worker" || /worker[-.]/i.test(name)) return "worker";
  if (initiatorType === "img" || /\.(?:png|jpe?g|webp)(?:\?|$)/i.test(name))
    return "image";
  return "other";
}

function resourceSource(entry: PerformanceResourceTiming): ResourceSample["source"] {
  if (entry.transferSize > 0) return "network";
  if (entry.decodedBodySize > 0) return "cache";
  return "unknown";
}

export function collectResourceSamples(
  source: BrowserPerformanceSource | null = nativeSource(),
): { support: MetricSupport; samples: ResourceSample[] } {
  if (!source || !source.supportedEntryTypes.includes("resource")) {
    return { support: "unsupported", samples: [] };
  }
  return {
    support: "supported",
    samples: source.resources().map((entry) => ({
      name: entry.name,
      kind: resourceKind(entry.name, entry.initiatorType),
      transferSize: Number.isFinite(entry.transferSize) ? entry.transferSize : null,
      decodedBodySize: Number.isFinite(entry.decodedBodySize)
        ? entry.decodedBodySize
        : null,
      source: resourceSource(entry),
    })),
  };
}

export function observeLongTasks(onSample: (sample: LongTaskSample) => void): {
  support: MetricSupport;
  disconnect(): void;
} {
  if (
    typeof PerformanceObserver === "undefined" ||
    !PerformanceObserver.supportedEntryTypes.includes("longtask")
  ) {
    return { support: "unsupported", disconnect: () => undefined };
  }
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      onSample({
        startedAtMs: entry.startTime,
        durationMs: entry.duration,
        attribution: "browser-or-unknown",
      });
    }
  });
  observer.observe({ entryTypes: ["longtask"] });
  return { support: "supported", disconnect: () => observer.disconnect() };
}
