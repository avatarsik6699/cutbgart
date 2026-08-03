import { describe, expect, it, vi } from "vitest";

import { createModelSourceLoader, type ModelSource } from "./model-source-loader";

describe("shared model source loader", () => {
  it("serializes loads and switches from CDN to upstream only once", async () => {
    const selected: ModelSource[] = [];
    const loader = createModelSourceLoader({
      cdnConfigured: true,
      selectSource: (source) => selected.push(source),
    });
    const first = vi
      .fn()
      .mockRejectedValueOnce(new Error("cdn"))
      .mockResolvedValue("one");
    const second = vi.fn().mockResolvedValue("two");
    await expect(Promise.all([loader.load(first), loader.load(second)])).resolves.toEqual(
      ["one", "two"],
    );
    expect(selected).toEqual(["cdn", "upstream"]);
    expect(loader.current()).toBe("upstream");
  });
});
