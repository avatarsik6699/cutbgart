import { describe, expect, it } from "vitest";

import { createEditorToolRegistry } from "./editor-tool-registry";

describe("editor tool registry", () => {
  it("keeps the stable public tool identity and order", () => {
    const registry = createEditorToolRegistry();

    expect(registry.map(({ id }) => id)).toEqual(["cutout", "enhance", "background"]);
    expect(registry.map(({ order }) => order)).toEqual([10, 20, 30]);
    expect(registry.every(({ label, icon }) => label && icon)).toBe(true);
    expect(registry.every((definition) => !("loadPanel" in definition))).toBe(true);
  });
});
