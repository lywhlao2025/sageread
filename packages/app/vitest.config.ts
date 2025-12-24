import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@pdfjs": path.resolve(__dirname, "./public/vendor/pdfjs"),
      "app-tabs": path.resolve(__dirname, "../app-tabs/src/index.tsx"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
