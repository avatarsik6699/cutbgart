import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors vite.config.ts — needed for shared/ui's shadcn-generated `@/*`
    // imports (components.json aliases) to resolve under Vitest too.
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Phase 02 added the first real suite (the original removal feature;
    // SPEC.md §7.7) — an empty suite should now fail the gate instead of
    // silently passing.
    passWithNoTests: false,
    // e2e/ holds Playwright specs (playwright.config.ts owns them) — Vitest's
    // default include glob otherwise picks up *.spec.ts here too and fails
    // trying to run `test.describe` outside the Playwright test runner.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
