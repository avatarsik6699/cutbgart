import { describe, expect, it } from "vitest";

import { ManualDraftEngine, MANUAL_DRAFT_PATCH_LIMIT } from "./manual-draft-engine";

describe("ManualDraftEngine", () => {
  it("erases with deterministic falloff and preserves every untouched byte", () => {
    const original = new Uint8ClampedArray(49).fill(200);
    const engine = new ManualDraftEngine(original, 7, 7);
    engine.begin({ x: 3, y: 3 }, { mode: "erase", radius: 2, hardness: 0 });
    const patch = engine.end();
    const changed = engine.alphaCopy();

    expect(changed[24]).toBe(0);
    expect(changed[17]).toBeGreaterThan(0);
    expect(changed[17]).toBeLessThan(200);
    expect(changed[0]).toBe(200);
    expect(patch?.before.length).toBeLessThan(original.length);
  });

  it("restores to source alpha and rolls back a cancelled pointer gesture", () => {
    const engine = new ManualDraftEngine(
      new Uint8ClampedArray(9),
      3,
      3,
      new Uint8ClampedArray(9).fill(180),
    );
    expect(engine.alphaCopy()[4]).toBe(0);
    engine.begin({ x: 1, y: 1 }, { mode: "restore", radius: 1.4, hardness: 1 });
    engine.cancelGesture();
    expect(engine.alphaCopy()[4]).toBe(0);
    engine.begin({ x: 1, y: 1 }, { mode: "restore", radius: 1.4, hardness: 1 });
    engine.end();
    expect(engine.alphaCopy()[4]).toBe(180);
  });

  it("updates the restore target from decoded source alpha", () => {
    const engine = new ManualDraftEngine(new Uint8ClampedArray(2), 2, 1);
    engine.setRestoreAlpha(new Uint8ClampedArray([96, 224]));

    engine.begin({ x: 0, y: 0 }, { mode: "restore", radius: 1, hardness: 1 });
    engine.end();

    expect(engine.alphaCopy()).toEqual(new Uint8ClampedArray([96, 0]));
  });

  it("tracks dirty state against the committed alpha while Restore targets source alpha", () => {
    const committed = new Uint8ClampedArray([0]);
    const automaticBaseline = new Uint8ClampedArray([255]);
    const engine = new ManualDraftEngine(committed, 1, 1, automaticBaseline);

    engine.begin({ x: 0, y: 0 }, { mode: "restore", radius: 2, hardness: 1 });
    engine.end();

    expect(engine.alphaCopy()[0]).toBe(255);
    expect(engine.dirty).toBe(true);
  });

  it("stores one patch per gesture and bounds local undo/redo", () => {
    const engine = new ManualDraftEngine(new Uint8ClampedArray(64).fill(255), 8, 8);
    for (let index = 0; index < MANUAL_DRAFT_PATCH_LIMIT + 4; index += 1) {
      engine.begin(
        { x: index % 8, y: Math.floor(index / 8) },
        { mode: "erase", radius: 0.8, hardness: 1 },
      );
      engine.end();
    }
    let undoCount = 0;
    while (engine.undo() !== null) undoCount += 1;
    expect(undoCount).toBe(MANUAL_DRAFT_PATCH_LIMIT);
    expect(engine.dirty).toBe(true);
    expect(engine.canRedo).toBe(true);
  });
});
