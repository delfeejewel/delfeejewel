import { defineConfig, devices } from "@playwright/test"

// Never point this at production. Guarded loosely in global-setup.ts too, but
// the base URLs below are the first line of defense.
const STOREFRONT_URL = process.env.STAGING_STOREFRONT_URL || "https://staging.delfee.in"
const ADMIN_URL = process.env.STAGING_ADMIN_URL || "https://api-staging.delfee.in"

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000, // Razorpay's iframe + admin fulfillment steps are slow
  expect: { timeout: 15_000 },
  fullyParallel: false, // the full-order-flow spec is a single linear story
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: STOREFRONT_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})

export const ADMIN_BASE_URL = ADMIN_URL
