import { describe, expect, it } from "vitest";

import { cn } from "./index";

describe("shared class merge", () => {
  it("combines conditional values and keeps the last conflicting Tailwind utility", () => {
    expect(cn("rounded-md px-2", false, null, ["text-sm", "px-4"])).toBe(
      "rounded-md text-sm px-4",
    );
  });
});
