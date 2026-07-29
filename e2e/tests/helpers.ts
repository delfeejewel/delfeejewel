import { type Page, expect } from "@playwright/test"
import { execFileSync } from "node:child_process"
import path from "node:path"

const PROD_HOSTS = ["delfee.in", "www.delfee.in", "api.delfee.in"]

/** Refuses to run against prod even if env vars are misconfigured. */
export function assertNotProd(url: string) {
  const host = new URL(url).host
  if (PROD_HOSTS.includes(host)) {
    throw new Error(
      `Refusing to run the E2E suite against a production host (${host}). ` +
        "Check STAGING_STOREFRONT_URL / STAGING_ADMIN_URL."
    )
  }
}

export const TEST_ADDRESS = {
  firstName: "Staging",
  lastName: "Tester",
  address1: "123 Test Lane",
  city: "Chandigarh",
  postalCode: "160001",
  province: "Chandigarh",
  phone: "9999999999",
}

// Distinct per-run email so repeated runs don't collide on an existing account,
// and — per hard rule — this must NEVER be itservices007ak@gmail.com.
export function testEmail() {
  const stamp = process.env.PLAYWRIGHT_RUN_STAMP || String(Date.now() % 1_000_000)
  return `e2e-staging-${stamp}@example.com`
}

/**
 * Which payment provider the checkout test drives.
 *
 * - "razorpay" (default, staging): the real thing, needs rzp_test_ credentials
 *   because Razorpay's checkout.js iframe has no offline/mock mode.
 * - "manual" (pp_system_default): completes a real order with no third party.
 *   The only option that works on a local stack with no PSP credentials.
 * - "cod": NOT viable on its own. src/utils/cod.ts always requires an upfront
 *   token (10% of the total, or a flat ₹200 below ₹2000) and that token is
 *   collected through Razorpay — so COD still needs Razorpay credentials.
 *   Kept selectable for staging, where those credentials exist.
 */
export const PAYMENT_METHOD = (process.env.E2E_PAYMENT_METHOD || "razorpay") as
  | "razorpay"
  | "manual"
  | "cod"

/** Selects a payment method and advances to the review step. */
export async function choosePaymentMethod(page: Page) {
  const label =
    PAYMENT_METHOD === "manual"
      ? /manual payment/i
      : PAYMENT_METHOD === "cod"
        ? /cash on delivery/i
        : /razorpay \(upi \/ cards \/ wallets\)/i
  await page.getByText(label).first().click()
  await page.getByTestId("submit-payment-button").click()
}

/**
 * Razorpay test-mode checkout: card 4111 1111 1111 1111, any future expiry,
 * any CVV, OTP 1111 (Razorpay's documented dummy OTP for test mode). Runs
 * inside the checkout.razorpay.com iframe Razorpay injects into the page.
 */
export async function payViaRazorpayTestCard(page: Page) {
  const rzpFrame = page.frameLocator('iframe[name^="razorpay"]').first()

  await rzpFrame.getByRole("tab", { name: /card/i }).click().catch(() => {})
  await rzpFrame.locator('input[name="card_number"], input[title="Card Number"]').fill("4111111111111111")
  await rzpFrame.locator('input[name="card_expiry"], input[title="Expiry"]').fill("12/30")
  await rzpFrame.locator('input[name="card_cvv"], input[title="CVV"]').fill("123")
  await rzpFrame.getByRole("button", { name: /pay/i }).click()

  // Test-mode OTP step, if Razorpay presents one.
  const otpInput = rzpFrame.locator('input[name="otp"], input[title="OTP"]')
  if (await otpInput.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await otpInput.fill("1111")
    await rzpFrame.getByRole("button", { name: /submit|continue/i }).click()
  }
}

/**
 * Runs the existing backend/src/scripts/bump-order-status.ts INSIDE the
 * staging backend container via SSH, so it runs against the staging DB
 * (whatever DATABASE_URL is in backend-staging.env on the droplet) — never
 * against a local checkout's own .env, which could point anywhere.
 *
 * Requires STAGING_SSH_HOST / STAGING_SSH_USER env vars (same droplet as
 * prod). Skips with a clear error if SSH access isn't configured for this
 * run — this is deliberately NOT silent, since a skipped delivery-simulation
 * step would otherwise look like a passing test.
 */
export function bumpOrderStatus(displayId: number | string, status: string) {
  // Local mode: run it through backend/e2e-local.sh, which exports .env.test
  // into the shell (the only reliable override — see that script's header for
  // why NODE_ENV=test alone does NOT work) and hard-aborts if DATABASE_URL
  // ever resolves to Supabase. That guard is what makes running this against
  // a local checkout safe, unlike invoking medusa directly.
  if (process.env.E2E_LOCAL === "true") {
    execFileSync(
      "./e2e-local.sh",
      ["npx", "medusa", "exec", "./src/scripts/bump-order-status.ts", String(displayId), status],
      { stdio: "inherit", cwd: path.resolve(__dirname, "../../backend") }
    )
    return
  }

  const host = process.env.STAGING_SSH_HOST
  const user = process.env.STAGING_SSH_USER || "root"
  if (!host) {
    throw new Error(
      "STAGING_SSH_HOST is not set — can't reach the staging container to " +
        "simulate the delivery event. See e2e/README.md."
    )
  }
  execFileSync(
    "ssh",
    [
      `${user}@${host}`,
      "cd /opt/delfee && docker compose -f docker-compose.staging.yml exec -T " +
        `backend-staging npx medusa exec ./src/scripts/bump-order-status.ts ${displayId} "${status}"`,
    ],
    { stdio: "inherit" }
  )
}

/**
 * Sets stock for every variant of a product via the project's own
 * set-stock.ts script, which goes through the service layer — raw SQL writes
 * to inventory_level are served stale by the inventory cache/index layer and
 * would make these tests lie.
 *
 * Local runs go through e2e-local.sh (which aborts if it ever resolves to the
 * production database); staging runs go over SSH into the staging container.
 */
export function setStock(handle: string, qty: number) {
  if (process.env.E2E_LOCAL === "true") {
    execFileSync(
      "./e2e-local.sh",
      ["npx", "medusa", "exec", "./src/scripts/set-stock.ts", handle, String(qty)],
      { stdio: "ignore", cwd: path.resolve(__dirname, "../../backend") }
    )
    return
  }

  const host = process.env.STAGING_SSH_HOST
  const user = process.env.STAGING_SSH_USER || "root"
  if (!host) {
    throw new Error(
      "STAGING_SSH_HOST is not set — can't change stock on staging. " +
        "Set E2E_LOCAL=true for a local run, or configure SSH."
    )
  }
  execFileSync(
    "ssh",
    [
      `${user}@${host}`,
      "cd /opt/delfee && docker compose -f docker-compose.staging.yml exec -T " +
        `backend-staging npx medusa exec ./src/scripts/set-stock.ts ${handle} ${qty}`,
    ],
    { stdio: "ignore" }
  )
}

/** Logs into the Medusa admin SPA. */
export async function adminLogin(page: Page, adminBaseUrl: string) {
  await page.goto(`${adminBaseUrl}/app/login`)
  const emailInput = page.locator('input[name="email"]')
  await expect(emailInput).toBeVisible({ timeout: 30_000 })
  await emailInput.fill(process.env.STAGING_ADMIN_EMAIL!)
  await page.locator('input[name="password"]').fill(process.env.STAGING_ADMIN_PASSWORD!)
  // Not getByRole(/sign in/) — the 2FA login widget adds a second button.
  await page.locator('button[type="submit"]').click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 })
}

/**
 * Opens a product page and adds the first available variant to the cart,
 * handling the "Select Options" state for multi-variant products. Resolves
 * once the cart cookie exists, so callers can navigate immediately without
 * racing the add-to-cart server action.
 */
export async function addToCart(page: Page, handle: string) {
  await page.goto(`/in/products/${handle}`)
  const addButton = page.getByRole("button", {
    name: /add to shopping bag|select options|out of stock/i,
  })
  await expect(addButton).toBeVisible({ timeout: 20_000 })

  if (/select options/i.test((await addButton.innerText()) || "")) {
    const seen = new Set<string>()
    for (const opt of await page.locator("[data-testid='product-option-value']").all()) {
      const label = await opt.getAttribute("data-option-value")
      if (label && !seen.has(label)) {
        seen.add(label)
        await opt.click()
        if (!/select options/i.test((await addButton.innerText()) || "")) break
      }
    }
  }

  await expect(addButton).toHaveText(/add to shopping bag/i, { timeout: 10_000 })

  // Wait on the add-to-cart server action itself, not on the cart cookie: the
  // cookie already exists from any previous add, so polling it would return
  // immediately and let the caller navigate mid-flight (which silently loses
  // the second item).
  const actionDone = page
    .waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes(`/products/${handle}`),
      { timeout: 20_000 }
    )
    .catch(() => null)

  await addButton.click()
  await actionDone
  await expect
    .poll(
      async () => (await page.context().cookies()).some((c) => c.name === "_medusa_cart_id"),
      { timeout: 20_000 }
    )
    .toBeTruthy()
}

/**
 * Several packing actions open a Medusa UI confirmation prompt ("Start packing
 * this order?" etc.) whose confirm button repeats the trigger's label. Clicking
 * the trigger alone does nothing — the action only runs once the prompt is
 * confirmed. No-ops when a given action has no prompt.
 */
export async function confirmPrompt(page: Page, action?: RegExp) {
  const dialog = page.getByRole("alertdialog")
  if (!(await dialog.isVisible({ timeout: 5_000 }).catch(() => false))) return
  const confirm = dialog.getByRole("button", {
    name: action ?? /confirm|continue|start|assign|yes|ok|ship|print/i,
  })
  await confirm.last().click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })
}

export async function expectVisibleText(page: Page, text: string | RegExp) {
  await expect(page.getByText(text)).toBeVisible()
}
