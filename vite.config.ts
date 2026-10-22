import { fileURLToPath, URL } from "node:url";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";
import { stripFoamTreeBranding } from "./vite.foamtree-branding";

function mediapipeWasm(): Plugin {
  const root = fileURLToPath(new URL("./node_modules/@mediapipe/tasks-vision/wasm", import.meta.url));
  const serve = (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const name = path.basename((req.url ?? "").split("?")[0] ?? "");
    const file = path.join(root, name);
    if (!name || !file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      next();
      return;
    }
    res.setHeader("Content-Type", name.endsWith(".wasm") ? "application/wasm" : "text/javascript");
    fs.createReadStream(file).pipe(res);
  };
  return {
    name: "mediapipe-wasm",
    configureServer(server) {
      server.middlewares.use("/mediapipe/wasm", serve);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/mediapipe/wasm", serve);
    },
    generateBundle() {
      for (const name of fs.readdirSync(root)) {
        const file = path.join(root, name);
        if (!fs.statSync(file).isFile()) {
          continue;
        }
        this.emitFile({
          type: "asset",
          fileName: `mediapipe/wasm/${name}`,
          source: fs.readFileSync(file),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), stripFoamTreeBranding(), mediapipeWasm()],
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
  server: {
    port: 8080,
    strictPort: true,
    // Windows file locks crash the watcher when it tries to watch the background video.
    watch: {
      ignored: ["**/*.mp4"],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
