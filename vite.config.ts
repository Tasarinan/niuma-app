import { defineConfig } from "vite";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import type { Plugin } from "vite";

function findEnvFileDir(startDir: string): string {
  let current = startDir;

  while (true) {
    for (const fileName of [".env.local", ".env"]) {
      const candidate = path.join(current, fileName);
      if (fs.existsSync(candidate)) {
        return current;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return startDir;
}

function resolveConfiguredDir(baseDir: string, configured: string | undefined, fallbackRelative: string): string {
  if (!configured?.trim()) {
    return path.resolve(baseDir, fallbackRelative);
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(baseDir, configured);
}

/** Serves the root-level `clawpacks/` directory as `/clawpacks/**` in dev
 *  and copies it into `dist/clawpacks/` at build time. */
function clawpacksPlugin(clawpacksDir: string): Plugin {
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
const envDir = findEnvFileDir(__dirname);

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const clawpacksDir = resolveConfiguredDir(envDir, env.NIUMA_CLAWPACKS_DIR, "clawpacks");

  return {
    plugins: [react(), tailwindcss(), clawpacksPlugin(clawpacksDir)],
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
  };
});
