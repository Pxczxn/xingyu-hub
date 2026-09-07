import { defineConfig, devices } from "@playwright/test";

const webBaseUrl = process.env.WEB_BASE_URL ?? "http://127.0.0.1:7777";
const adminBaseUrl = process.env.ADMIN_BASE_URL ?? "http://127.0.0.1:7778";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./global-setup.ts",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "community-web",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: webBaseUrl,
      },
    },
    {
      name: "admin",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: adminBaseUrl,
      },
      testMatch: /.*\.admin\.spec\.ts/,
    },
  ],
});
