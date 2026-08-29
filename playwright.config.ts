import { defineConfig } from "@playwright/test";

const externalBaseUrl = process.env.PHASE0_BASE_URL;

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: "test-results/playwright",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  retries: 0,
  testDir: "tests",
  timeout: 30_000,
  use: {
    baseURL: externalBaseUrl ?? "http://localhost:3100",
    channel: "chrome",
    headless: process.env.PHASE0_HEADED !== "1",
    launchOptions: {
      args: [
        "--enable-features=WebMCP,WebMCPTesting",
        "--enable-blink-features=WebMCP",
      ],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "pnpm dev:phase0",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        url: "http://localhost:3100",
      },
  workers: 1,
});
