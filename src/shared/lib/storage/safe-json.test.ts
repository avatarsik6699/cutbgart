import { describe, expect, it } from "vitest";

import { safeJsonParse } from "./safe-json";

interface Point {
  x: number;
  y: number;
}

function isPoint(value: unknown): value is Point {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Point).x === "number" &&
    typeof (value as Point).y === "number"
  );
}

describe("safeJsonParse", () => {
  it("parses and validates a well-formed value", () => {
    expect(safeJsonParse('{"x":1,"y":2}', isPoint)).toEqual({ x: 1, y: 2 });
  });

  it("returns null for malformed JSON instead of throwing", () => {
    expect(safeJsonParse("{not json", isPoint)).toBeNull();
  });

  it("returns null when the parsed shape fails the type guard", () => {
    expect(safeJsonParse('{"x":1}', isPoint)).toBeNull();
    expect(safeJsonParse("42", isPoint)).toBeNull();
  });

  it("returns null for null/undefined/empty input", () => {
    expect(safeJsonParse(null, isPoint)).toBeNull();
    expect(safeJsonParse(undefined, isPoint)).toBeNull();
    expect(safeJsonParse("", isPoint)).toBeNull();
  });
});
