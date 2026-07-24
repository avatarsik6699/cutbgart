import { describe, expect, it } from "vitest";

import {
  GUIDED_BRUSH_HARD_CORE_RATIO,
  MAX_GUIDED_BRUSH_PROMPTS,
  consolidateGuidedBrushStrokes,
  guidedBrushHardCoreRadius,
} from "./guided-brush-sampling";
import type { GuidedBrushStroke } from "./types";

describe("guided brush sampling", () => {
  it("consolidates overlaps with latest intent and caps the whole session at 32", () => {
    const strokes: GuidedBrushStroke[] = Array.from({ length: 12 }, (_, index) => ({
      id: `keep-${String(index)}`,
      mode: "keep" as const,
      points: [
        { x: index / 12, y: 0.2 },
        { x: index / 12, y: 0.8 },
      ],
      radius: 3,
    }));
    strokes.push({
      id: "remove-latest",
      mode: "remove",
      points: [
        { x: 0.1, y: 0.5 },
        { x: 0.9, y: 0.5 },
      ],
      radius: 3,
    });
    const result = consolidateGuidedBrushStrokes(strokes, 120, 80);
    expect(result.points.length).toBeLessThanOrEqual(MAX_GUIDED_BRUSH_PROMPTS);
    expect(result.points.filter((point) => point.label === 1)).toHaveLength(16);
    expect(result.points.filter((point) => point.label === 0)).toHaveLength(16);
    expect(result.constraints.data[40 * 120 + 60]).toBe(0);
    expect(result.influenceMask[40 * 120 + 60]).toBe(1);
    expect(result.editRegion).not.toBeNull();
  });

  it("does not invent a green prompt for a red-only direct session", () => {
    const result = consolidateGuidedBrushStrokes(
      [
        {
          id: "remove",
          mode: "remove",
          points: [{ x: 0.5, y: 0.5 }],
          radius: 4,
        },
      ],
      32,
      32,
    );
    expect(result.keepCount).toBe(0);
    expect(result.points.every((point) => point.label === 0)).toBe(true);
    expect(result.influenceMask.some((value) => value === 1)).toBe(true);
  });

  it("is deterministic and spatially representative", () => {
    const stroke = {
      id: "keep",
      mode: "keep" as const,
      points: [
        { x: 0.05, y: 0.05 },
        { x: 0.95, y: 0.95 },
      ],
      radius: 2,
    };
    const first = consolidateGuidedBrushStrokes([stroke], 100, 100);
    const second = consolidateGuidedBrushStrokes([stroke], 100, 100);
    expect(first.points).toEqual(second.points);
    expect(Math.min(...first.points.map((point) => point.x))).toBeLessThan(0.25);
    expect(Math.max(...first.points.map((point) => point.x))).toBeGreaterThan(0.75);
  });

  it("uses a 35% hard core inside the full-radius influence halo", () => {
    const result = consolidateGuidedBrushStrokes(
      [
        {
          id: "remove",
          mode: "remove",
          points: [{ x: 0.5, y: 0.5 }],
          radius: 10,
        },
      ],
      101,
      101,
    );
    const at = (x: number, y = 50) => y * 101 + x;
    expect(GUIDED_BRUSH_HARD_CORE_RATIO).toBe(0.35);
    expect(guidedBrushHardCoreRadius(10)).toBe(4);
    expect(result.constraints.data[at(54)]).toBe(0);
    expect(result.constraints.data[at(55)]).toBe(-1);
    expect(result.influenceMask[at(60)]).toBe(1);
    expect(result.influenceMask[at(61)]).toBe(0);
  });

  it("samples model prompts from the stroke centreline rather than its disk", () => {
    const result = consolidateGuidedBrushStrokes(
      [
        {
          id: "keep-line",
          mode: "keep",
          points: [
            { x: 0.1, y: 0.5 },
            { x: 0.9, y: 0.5 },
          ],
          radius: 12,
        },
      ],
      100,
      100,
      8,
    );
    expect(result.points).toHaveLength(8);
    expect(result.points.every((point) => point.y === 0.505)).toBe(true);
    expect(Math.min(...result.points.map((point) => point.x))).toBeLessThan(0.2);
    expect(Math.max(...result.points.map((point) => point.x))).toBeGreaterThan(0.8);
  });
});
