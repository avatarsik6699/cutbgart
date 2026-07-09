import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // No test files exist yet — real coverage lands with Phase 02's
    // features/remove-background (SPEC.md §7.7). Without this, CI would
    // fail on an empty suite before there's anything to test.
    passWithNoTests: true,
  },
});
