import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // Phase 02 adds the first real suite (features/remove-background,
    // SPEC.md §7.7) — an empty suite should now fail the gate instead of
    // silently passing.
    passWithNoTests: false,
  },
});
