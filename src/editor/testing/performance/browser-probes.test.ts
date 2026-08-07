import { describe, expect, it } from "vitest";

import {
  collectResourceSamples,
  detectPerformanceSupport,
  type BrowserPerformanceSource,
} from "./browser-probes";

function resource(
  name: string,
  initiatorType: string,
  transferSize: number,
  decodedBodySize: number,
): PerformanceResourceTiming {
  return {
    name,
    initiatorType,
    transferSize,
    decodedBodySize,
  } as PerformanceResourceTiming;
}

describe("browser performance probes", () => {
  it("reports capability support separately from sample count", () => {
    expect(detectPerformanceSupport(null)).toEqual({
      userTiming: "unsupported",
      longTasks: "unsupported",
      eventTiming: "unsupported",
      resources: "unsupported",
    });
    expect(
      detectPerformanceSupport({
        supportedEntryTypes: ["resource"],
        resources: () => [],
      }),
    ).toMatchObject({ longTasks: "unsupported", resources: "supported" });
  });

  it("classifies network and cache resources without inventing byte counts", () => {
    const source: BrowserPerformanceSource = {
      supportedEntryTypes: ["resource"],
      resources: () => [
        resource("https://cdn.cutbg.art/model.onnx", "fetch", 200, 180),
        resource("/assets/processing.worker.js", "worker", 0, 120),
        resource("opaque", "fetch", 0, 0),
      ],
    };
    expect(collectResourceSamples(source)).toEqual({
      support: "supported",
      samples: [
        expect.objectContaining({ kind: "model", source: "network" }),
        expect.objectContaining({ kind: "worker", source: "cache" }),
        expect.objectContaining({ kind: "other", source: "unknown" }),
      ],
    });
  });
});
