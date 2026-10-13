import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { stripFoamTreeBranding } from "./vite.foamtree-branding";

export default defineConfig({
  plugins: [react(), stripFoamTreeBranding()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    // Keep FoamTree out of the prebundle so the branding strip transform applies.
    exclude: ["web-ifc", "@carrotsearch/foamtree"],
  },
  assetsInclude: ["**/*.wasm"],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
