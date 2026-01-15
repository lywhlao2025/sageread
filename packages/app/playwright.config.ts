import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const isCI = !!process.env.CI;
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: isCI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:1420",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "VITE_E2E=1 pnpm dev",
    cwd: __dirname,
    url: "http://127.0.0.1:1420",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
