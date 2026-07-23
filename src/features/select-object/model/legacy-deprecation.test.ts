import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase-17 selective deprecation", () => {
  it("deprecates only production-unreferenced UI exports", () => {
    const indexSource = readFileSync(
      resolve(process.cwd(), "src/features/select-object/index.ts"),
      "utf8",
    );
    expect(indexSource).toMatch(
      /@deprecated Phase-17 compatibility UI; production uses `GuidedBrushCanvas`/,
    );
    expect(indexSource).toMatch(
      /@deprecated Phase-17 compatibility UI; production uses `GuidedBrushControls`/,
    );
    expect(indexSource).not.toMatch(/@deprecated[\s\S]{0,80}useObjectSelection/);
    expect(indexSource).not.toMatch(/@deprecated[\s\S]{0,80}PromptSession/);
    expect(indexSource).not.toMatch(/@deprecated[\s\S]{0,80}fuseGuidedMattes/);
  });
});
