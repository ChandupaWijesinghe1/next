import { defineConfig, devices } from "@playwright/test"

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
const isCI = !!process.env.CI
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  workers: 1,
  reporter: isCI
    ? [["list"], ["html", { open: "never" }], ["github"]]
    : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  // Locally: start Next.js itself. In CI the workflow builds + starts `next start`.
  ...(skipWebServer
    ? {}
    : {
        webServer: {
          command: isCI
            ? "npm run start -- --hostname 127.0.0.1 --port 3000"
            : "npx next dev --webpack --hostname 127.0.0.1 --port 3000",
          url: BASE_URL,
          reuseExistingServer: !isCI,
          timeout: 180_000,
        },
      }),
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: [/.*\.setup\.ts/, /signup\.spec\.ts/, /login\.spec\.ts/],
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: [/.*\.setup\.ts/, /signup\.spec\.ts/, /login\.spec\.ts/],
    },
    {
      name: "chromium-unauthenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
      testMatch: [/signup\.spec\.ts/, /login\.spec\.ts/],
    },
    {
      name: "firefox-unauthenticated",
      use: {
        ...devices["Desktop Firefox"],
        storageState: { cookies: [], origins: [] },
      },
      testMatch: [/signup\.spec\.ts/, /login\.spec\.ts/],
    },
  ],
})
