import { defineConfig, devices } from "@playwright/test"

const frontend = process.env.E2E_FRONTEND_BASE ?? "http://127.0.0.1:5176"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: frontend,
    actionTimeout: 20_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "auth", testMatch: /auth\.setup\.ts/ },
    { name: "setup", testMatch: /setup\.spec\.ts/, dependencies: ["auth"] },
    { name: "cdm", testMatch: /cdm\.spec\.ts/, dependencies: ["setup"] },
    {
      name: "submissions",
      testMatch: /submissions\.spec\.ts/,
      dependencies: ["cdm"],
    },
    { name: "reviews", testMatch: /reviews\.spec\.ts/, dependencies: ["submissions"] },
    { name: "arcus", testMatch: /arcus\.spec\.ts/, dependencies: ["reviews"] },
    { name: "postevals", testMatch: /postevals\.spec\.ts/, dependencies: ["arcus"] },
    {
      name: "reservation-changes",
      testMatch: /reservation-changes\.spec\.ts/,
      dependencies: ["postevals"],
    },
    { name: "members", testMatch: /members\.spec\.ts/, dependencies: ["setup"] },
    { name: "announcements", testMatch: /announcements\.spec\.ts/, dependencies: ["setup"] },
    { name: "calendar", testMatch: /calendar\.spec\.ts/, dependencies: ["reviews"] },
    {
      name: "monitor",
      testMatch: /monitor\.spec\.ts/,
      dependencies: ["reservation-changes"],
    },
    { name: "reports", testMatch: /reports\.spec\.ts/, dependencies: ["monitor"] },
  ],
})
