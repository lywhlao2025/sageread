import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;
const isE2E = process.env.VITE_E2E === "1";
const mockRoot = path.resolve(__dirname, "./src/mocks/tauri");

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@pdfjs": path.resolve(__dirname, "./public/vendor/pdfjs"),
      "app-tabs": path.resolve(__dirname, "../app-tabs/src/index.tsx"),
      ...(isE2E
        ? {
            "@tauri-apps/api/core": path.resolve(mockRoot, "api/core.ts"),
            "@tauri-apps/api/path": path.resolve(mockRoot, "api/path.ts"),
            "@tauri-apps/api/event": path.resolve(mockRoot, "api/event.ts"),
            "@tauri-apps/api/app": path.resolve(mockRoot, "api/app.ts"),
            "@tauri-apps/api/window": path.resolve(mockRoot, "api/window.ts"),
            "@tauri-apps/api/menu": path.resolve(mockRoot, "api/menu.ts"),
            "@tauri-apps/plugin-fs": path.resolve(mockRoot, "plugins/fs.ts"),
            "@tauri-apps/plugin-http": path.resolve(mockRoot, "plugins/http.ts"),
            "@tauri-apps/plugin-dialog": path.resolve(mockRoot, "plugins/dialog.ts"),
            "@tauri-apps/plugin-opener": path.resolve(mockRoot, "plugins/opener.ts"),
            "@tauri-apps/plugin-updater": path.resolve(mockRoot, "plugins/updater.ts"),
            "@tauri-apps/plugin-os": path.resolve(mockRoot, "plugins/os.ts"),
          }
        : {}),
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
    host: isE2E ? "127.0.0.1" : host || false,
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
