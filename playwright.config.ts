import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3100",
  },
  // Production server: CI builds first (`pnpm build`), then the server starts
  // here. Locally, reuse your own `pnpm start --port 3100` (or dev) server.
  webServer: {
    command: "pnpm start --port 3100",
    port: 3100,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: "3100",
    } as Record<string, string>,
  },
});
