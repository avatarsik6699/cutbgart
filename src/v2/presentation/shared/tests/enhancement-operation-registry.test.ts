import { describe, expect, it } from "vitest";

import {
  createEnhancementDraft,
  createEnhancementOperationRegistry,
  updateEnhancementDraft,
} from "../enhancement-operation-registry";

describe("enhancement operation registry", () => {
  it("keeps user outcomes ordered and hides their implementation kind from labels", () => {
    const registry = createEnhancementOperationRegistry();
    expect(registry.map(({ id }) => id)).toEqual(["fine-detail", "colour-halo"]);
    expect(registry.map(({ executionAdapter }) => executionAdapter)).toEqual([
      "matte-refinement",
      "foreground-cleanup",
    ]);
    expect(registry.map(({ label, help }) => `${label} ${help}`)).not.toContainEqual(
      expect.stringMatching(/ViTMatte|model|provider|WASM|WebGPU|graph|MiB/i),
    );
  });

  it("creates the safe default combination and maintains its typed draft flags", () => {
    const registry = createEnhancementOperationRegistry();
    let draft = createEnhancementDraft(registry, { inferencePath: "wasm" });
    expect(draft).toMatchObject({
      selectedOperationIds: ["fine-detail", "colour-halo"],
      improveDetail: true,
      removeColourHalo: true,
      dirty: false,
      status: "idle",
    });

    draft = updateEnhancementDraft(draft, "colour-halo", false);
    expect(draft).toMatchObject({
      selectedOperationIds: ["fine-detail"],
      improveDetail: true,
      removeColourHalo: false,
      dirty: true,
    });
  });

  it("uses explicit availability and one shared history label", () => {
    const registry = createEnhancementOperationRegistry();
    expect(
      registry.every((operation) =>
        operation.isAvailable({ hasAlphaMatte: true, busy: false }),
      ),
    ).toBe(true);
    expect(
      registry.some((operation) =>
        operation.isAvailable({ hasAlphaMatte: false, busy: false }),
      ),
    ).toBe(false);
    expect(new Set(registry.map(({ historyLabel }) => historyLabel)).size).toBe(1);
  });
});
