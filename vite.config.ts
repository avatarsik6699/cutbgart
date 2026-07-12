import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig({
  server: {
    port: 3000,
  },
  // Transformers.js and client-zip are imported lazily after user actions.
  // Pre-optimizing them prevents a late dependency scan from reloading the
  // page or returning an "Outdated Optimize Dep" response mid-flow.
  optimizeDeps: {
    include: ["@huggingface/transformers", "client-zip"],
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    // Must run before tanstackStart() so src/paraglide/ exists before the
    // router/server entries that import from it are compiled (SPEC.md §5.5).
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      strategy: ["url", "baseLocale"],
      // `ru` is the base/unprefixed locale (preserves every existing path
      // from SPEC.md §5.1 exactly); `en` is served under /en/...
      //
      // The four scenario pages get genuinely translated English slugs
      // (Phase 12 F11) rather than a plain /en/ prefix of the ru slug, so
      // each needs its own specific pattern — listed before the generic
      // catch-all per Paraglide's matching rules (specific patterns must
      // precede wildcards or they're never reached).
      urlPatterns: [
        {
          pattern: "/udalit-fon-s-foto-tovara",
          localized: [
            ["en", "/en/remove-background-from-product-photo"],
            ["ru", "/udalit-fon-s-foto-tovara"],
          ],
        },
        {
          pattern: "/udalit-fon-s-foto-na-dokumenty",
          localized: [
            ["en", "/en/remove-background-from-id-photo"],
            ["ru", "/udalit-fon-s-foto-na-dokumenty"],
          ],
        },
        {
          pattern: "/udalit-fon-s-logotipa",
          localized: [
            ["en", "/en/remove-background-from-logo"],
            ["ru", "/udalit-fon-s-logotipa"],
          ],
        },
        {
          pattern: "/udalit-fon-dlya-avatarki",
          localized: [
            ["en", "/en/remove-background-from-avatar"],
            ["ru", "/udalit-fon-dlya-avatarki"],
          ],
        },
        {
          pattern: "/:path(.*)?",
          localized: [
            ["en", "/en/:path(.*)?"],
            ["ru", "/:path(.*)?"],
          ],
        },
      ],
    }),
    tanstackStart(),
    nitro(),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
});
