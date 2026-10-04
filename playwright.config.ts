import { defineConfig, devices } from "@playwright/test";

// E2E against a local stack with demo data: npx supabase start && npm run seed && npm run build && npm start
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    locale: "ru-RU",
    trace: "retain-on-failure",
  },
  projects: [
    // Signs in once per role; specs reuse the saved session instead of logging in for every test
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "client",
      testMatch: /client\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], browserName: "chromium" },
    },
    {
      name: "admin",
      testMatch: /admin\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } },
    },
  ],
});
