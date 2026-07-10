import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      // This project's phased delivery plan (docs/SPEC.md §8) deliberately
      // lands each entity/feature slice one phase before its second consumer
      // exists (e.g. `entities/processed-image` and `features/remove-background`
      // are proven in isolation on a dev-only test page in Phase 02, ahead of
      // `pages/home` composing them in Phase 04) — so "only one reference"
      // is expected, not a sign these slices should be merged.
      "fsd/insignificant-slice": "off",
    },
  },
]);
