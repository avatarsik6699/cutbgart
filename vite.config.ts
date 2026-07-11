import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  // The inference worker imports Transformers.js lazily after upload. Without
  // an explicit include, Vite discovers it mid-flow, optimizes it, and reloads
  // the page — losing the selected file in dev and real-model E2E runs.
  optimizeDeps: {
    include: ["@huggingface/transformers"],
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro(),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
});
