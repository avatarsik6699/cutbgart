import { describe, expect, it } from "vitest";

import { createBenchmarkExport, serializeBenchmarkExport } from "./benchmark-export";

describe("benchmark export", () => {
  it("exports technical records without filenames, blobs, or preview URLs", () => {
    const value = createBenchmarkExport({
      createdAt: new Date("2026-07-13T12:00:00.000Z"),
      capabilities: {
        requestedPath: "wasm",
        userAgent: "test-browser",
        hardwareConcurrency: 8,
        deviceMemoryGb: 4,
        crossOriginIsolated: false,
      },
      selectedModelIds: ["ben2-fp16", "mvanet-q4"],
      imageCount: 1,
      measurements: [
        {
          imageOrdinal: 1,
          modelId: "ben2-fp16",
          requestedPath: "wasm",
          actualPath: "wasm",
          status: "success",
          loadMs: 100,
          inferenceMs: 20,
        },
      ],
      preferences: [{ imageOrdinal: 1, preferredModelId: "mvanet-q4" }],
    });

    const json = serializeBenchmarkExport(value);
    expect(JSON.parse(json)).toEqual(value);
    expect(json).not.toMatch(/filename|blob:|data:image|sourceUrl|resultUrl/i);
    expect(value.models[0]?.revision).toMatch(/^[a-f0-9]{40}$/);
  });
});
