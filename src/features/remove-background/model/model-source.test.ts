import { describe, expect, it, vi } from "vitest";

import { createModelSourceLoader, type ModelSource } from "./model-source";

describe("createModelSourceLoader", () => {
  it("uses upstream directly when no CDN is configured", async () => {
    const selected: ModelSource[] = [];
    const loader = createModelSourceLoader({
      cdnConfigured: false,
      selectSource: (source) => selected.push(source),
    });
    const factory = vi.fn().mockResolvedValue("ready");

    await expect(loader.load(factory)).resolves.toBe("ready");
    expect(factory).toHaveBeenCalledTimes(1);
    expect(selected).toEqual(["upstream"]);
  });

  it("retries once upstream and keeps upstream selected after a CDN failure", async () => {
    const selected: ModelSource[] = [];
    const onFallback = vi.fn();
    const factory = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("cdn unavailable"))
      .mockResolvedValue("ready");
    const loader = createModelSourceLoader({
      cdnConfigured: true,
      selectSource: (source) => selected.push(source),
    });

    await expect(loader.load(factory, { onFallback })).resolves.toBe("ready");
    await expect(loader.load(factory)).resolves.toBe("ready");
    expect(selected).toEqual(["cdn", "upstream"]);
    expect(onFallback).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledTimes(3);
    expect(loader.current()).toBe("upstream");
  });

  it("reports both failures when CDN and upstream fail", async () => {
    const loader = createModelSourceLoader({
      cdnConfigured: true,
      selectSource: () => undefined,
    });
    const factory = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("cdn unavailable"))
      .mockRejectedValueOnce(new Error("hub unavailable"));

    await expect(loader.load(factory)).rejects.toThrow(
      /both the configured CDN and the upstream/,
    );
  });
});
