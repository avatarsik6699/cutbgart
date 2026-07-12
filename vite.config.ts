import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
    tanstackStart(),
    nitro(),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
});
