import { defineConfig, devices } from "@playwright/test";

// E2E against a local stack with demo data: npx supabase start && npm run seed && npm run build && npm start.
// AI assistant specs need the app started with the stand-in model (tests/e2e/ai-mock.ts, started here):
// AI_BASE_URL=http://127.0.0.1:4010/v1 AI_API_KEY=test AI_MODEL=mock AI_REPLY_DELAY_MS=0 npm start — otherwise they are skipped
export default defineConfig({
  testDir: "tests/e2e",
  webServer: { command: "node --import tsx tests/e2e/ai-mock.ts", url: "http://127.0.0.1:4010/health", reuseExistingServer: true },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    // A fresh client address per run keeps repeated runs under the per-IP sign-in limit
    extraHTTPHeaders: { "x-real-ip": `198.51.100.${Math.floor(Math.random() * 254) + 1}` },
    locale: "ru-RU",
    trace: "retain-on-failure",
  },
  projects: [
    // Signs in once per role; specs reuse the saved session instead of logging in for every test
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "client",
      testMatch: /(client|calculator)\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], browserName: "chromium" },
    },
    {
      name: "admin",
      testMatch: /(admin|assistant)\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } },
    },
  ],
});
