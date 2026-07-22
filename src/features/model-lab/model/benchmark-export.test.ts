import { describe, expect, it } from "vitest";

import {
  createBenchmarkExport,
  createInteractiveBenchmarkExport,
  serializeBenchmarkExport,
  serializeInteractiveBenchmarkExport,
} from "./benchmark-export";

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

describe("interactive matting benchmark export", () => {
  it("exports schema v2 pins and aggregate evidence without image-derived data", () => {
    const value = createInteractiveBenchmarkExport({
      createdAt: new Date("2026-07-22T12:00:00.000Z"),
      capabilities: {
        requestedPath: "wasm",
        userAgent: "test-browser",
        hardwareConcurrency: 4,
        deviceMemoryGb: null,
        crossOriginIsolated: false,
      },
      selectedModelIds: ["vitmatte-small-composition1k-q8"],
      corpusCaseCount: 1,
      quality: [
        {
          caseOrdinal: 1,
          modelId: "vitmatte-small-composition1k-q8",
          iou: 0.9,
          boundaryIou: 0.8,
          sad: 0.1,
          mse: 0.01,
          gradient: 0.02,
          connectivity: 0.03,
          interactionsToAccept: null,
        },
      ],
      runtime: [
        {
          caseOrdinal: 1,
          modelId: "vitmatte-small-composition1k-q8",
          requestedPath: "wasm",
          actualPath: "wasm",
          status: "success",
          coldLoadMs: 100,
          warmInferenceMs: 20,
          peakMemoryBytes: null,
          memoryObservation: "unavailable",
        },
      ],
      decision: "none",
    });
    const json = serializeInteractiveBenchmarkExport(value);
    expect(value.schemaVersion).toBe(2);
    expect(value.candidates[0]?.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(json).not.toMatch(/filename|blob:|data:image|sourceUrl|resultUrl|prompt/i);
  });
});
