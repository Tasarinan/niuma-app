import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import type { Plugin } from "vite";

/** Serves the root-level `clawpacks/` directory as `/clawpacks/**` in dev
 *  and copies it into `dist/clawpacks/` at build time. */
function clawpacksPlugin(): Plugin {
  const clawpacksDir = path.resolve(__dirname, "clawpacks");
  const MIME: Record<string, string> = {
    ".json": "application/json",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  function copyDir(src: string, dest: string) {
    fs.mkdirSync(dest, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, e.name), d = path.join(dest, e.name);
      e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
    }
  }

  return {
    name: "vite-plugin-clawpacks",
    configureServer(server) {
      server.middlewares.use("/clawpacks", (req, res, next) => {
        const file = path.join(clawpacksDir, decodeURIComponent(req.url ?? "/"));
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream");
          res.end(fs.readFileSync(file));
        } else {
          next();
        }
      });
    },
    closeBundle() {
      const dest = path.resolve(__dirname, "dist/clawpacks");
      if (fs.existsSync(clawpacksDir)) copyDir(clawpacksDir, dest);
    },
  };
}

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), clawpacksPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
