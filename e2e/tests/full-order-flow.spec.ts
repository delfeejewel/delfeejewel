import { test, expect } from "@playwright/test"
import { ADMIN_BASE_URL } from "../playwright.config"
import {
  assertNotProd,
  TEST_ADDRESS,
  testEmail,
  payViaRazorpayTestCard,
  bumpOrderStatus,
  choosePaymentMethod,
  confirmPrompt,
  PAYMENT_METHOD,
} from "./helpers"

// Full real-user flow against the STAGING deployment only:
// browse -> cart -> checkout -> Razorpay test payment -> confirmation ->
// admin packing -> AWB (simulated) -> ready-to-ship -> shipped -> delivered.
//
// Requires env: STAGING_STOREFRONT_URL, STAGING_ADMIN_URL,
// STAGING_ADMIN_EMAIL, STAGING_ADMIN_PASSWORD, and a seeded product reachable
// at STAGING_PRODUCT_HANDLE (defaults to a known catalog handle — override if
// staging's catalog differs from prod's).
const PRODUCT_HANDLE = process.env.STAGING_PRODUCT_HANDLE || ""

test.describe("full order flow (staging only)", () => {
  test.beforeAll(async () => {
    assertNotProd(process.env.STAGING_STOREFRONT_URL || "https://staging.delfee.in")
    assertNotProd(ADMIN_BASE_URL)
    if (!PRODUCT_HANDLE) {
      throw new Error(
        "STAGING_PRODUCT_HANDLE is not set — point it at a real, in-stock, " +
          "single-region product handle seeded on staging."
      )
    }
  })

  // Lets the admin/delivery tests run standalone against an order that already
  // exists (e.g. one created by backend/src/scripts/seed-order.ts). Useful when
  // the checkout leg can't run — a local stack has no PSP credentials — and for
  // re-running just the fulfilment half without placing a new order each time.
  let displayId: string = process.env.E2E_ORDER_DISPLAY_ID || ""

  test("customer places an order and pays via Razorpay (test mode)", async ({ page }) => {
    test.skip(
      !!process.env.E2E_ORDER_DISPLAY_ID,
      "E2E_ORDER_DISPLAY_ID is set — testing fulfilment against an existing order"
    )
    await page.goto(`/in/products/${PRODUCT_HANDLE}`)

    // Multi-variant products render as "Select Options" until every option has
    // a value, so pick the first value of each option group before adding.
    const addButton = page.getByRole("button", {
      name: /add to shopping bag|select options|out of stock/i,
    })
    await expect(addButton).toBeVisible({ timeout: 20_000 })
    if (/select options/i.test((await addButton.innerText()) || "")) {
      const groups = page.locator("[data-testid='product-option-value']")
      const seen = new Set<string>()
      for (const opt of await groups.all()) {
        const label = await opt.getAttribute("data-option-value")
        // One click per option group: the first value we haven't picked yet.
        if (label && !seen.has(label)) {
          seen.add(label)
          await opt.click()
          if (!/select options/i.test((await addButton.innerText()) || "")) break
        }
      }
    }
    await expect(addButton).toHaveText(/add to shopping bag/i, { timeout: 10_000 })
    await addButton.click()

    // There's no success toast. Adding runs as a server action that sets the
    // _medusa_cart_id cookie, so wait for that cookie rather than navigating
    // straight away — otherwise /in/cart can load before Set-Cookie lands and
    // renders the empty-cart state despite the item existing server-side.
    await expect
      .poll(
        async () =>
          (await page.context().cookies()).some((c) => c.name === "_medusa_cart_id"),
        { timeout: 20_000 }
      )
      .toBeTruthy()

    await page.goto("/in/cart")
    await expect(page.getByTestId("product-row").first()).toBeVisible({ timeout: 20_000 })
    await page.getByTestId("checkout-button").click()

    // Step 1: address
    await page.getByTestId("shipping-first-name-input").fill(TEST_ADDRESS.firstName)
    await page.getByTestId("shipping-last-name-input").fill(TEST_ADDRESS.lastName)
    await page.getByTestId("shipping-address-input").fill(TEST_ADDRESS.address1)
    await page.getByTestId("shipping-postal-code-input").fill(TEST_ADDRESS.postalCode)
    await page.getByTestId("shipping-city-input").fill(TEST_ADDRESS.city)
    await page.getByTestId("shipping-province-input").fill(TEST_ADDRESS.province)
    await page.getByTestId("shipping-email-input").fill(testEmail())
    await page.getByTestId("shipping-phone-input").fill(TEST_ADDRESS.phone)
    await page.getByRole("button", { name: /continue to (delivery|payment)/i }).click()

    // Step 2: payment method (Razorpay on staging; COD locally, where no
    // rzp_test_ credentials are available — see helpers.PAYMENT_METHOD)
    await choosePaymentMethod(page)

    // Step 3: review + place order
    await page.getByTestId("terms-agree-checkbox").click()
    await page.getByTestId("submit-order-button").click()

    if (PAYMENT_METHOD === "razorpay") {
      await payViaRazorpayTestCard(page)
    }

    await expect(page.getByTestId("order-complete-container")).toBeVisible({ timeout: 45_000 })

    const orderIdText = await page.getByTestId("order-complete-container").innerText()
    const match = orderIdText.match(/#(\d+)/)
    expect(match, "couldn't find an order display_id on the confirmation page").toBeTruthy()
    displayId = match![1]
  })

  test("admin packs, assigns AWB (simulated), and ships the order", async ({ page }) => {
    test.skip(!displayId, "previous test didn't produce an order id")

    await page.goto(`${ADMIN_BASE_URL}/app/login`)
    // The admin is a Vite SPA whose login inputs aren't label-associated —
    // target them by name, which is stable across Medusa admin versions.
    const emailInput = page.locator('input[name="email"]')
    await expect(emailInput).toBeVisible({ timeout: 30_000 })
    await emailInput.fill(process.env.STAGING_ADMIN_EMAIL!)
    await page.locator('input[name="password"]').fill(process.env.STAGING_ADMIN_PASSWORD!)
    // Not getByRole(/sign in/) — the 2FA login widget adds its own
    // "Sign in with two-factor authentication" button alongside this one.
    await page.locator('button[type="submit"]').click()

    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 })
    await page.goto(`${ADMIN_BASE_URL}/app/packing`)

    // Safety net: refuse to proceed if staging isn't actually in simulate mode
    // — this must never touch a real Shiprocket courier.
    await expect(page.getByTestId("packing-simulate-banner")).toBeVisible({ timeout: 15_000 })

    const row = page.getByTestId("packing-queue-row").filter({ hasText: `#${displayId}` })
    await row.click()
    await expect(page.getByTestId("packing-drawer-title")).toContainText(`#${displayId}`)

    await page.getByTestId("packing-start-button").click()
    await confirmPrompt(page, /start packing/i)

    // The per-item checkboxes only render once packing has started.
    const checkboxes = page.getByTestId("packing-item-checkbox")
    await expect(checkboxes.first()).toBeVisible({ timeout: 20_000 })
    for (const cb of await checkboxes.all()) {
      if (!(await cb.isChecked())) await cb.click()
    }

    await page.getByTestId("packing-assign-awb-button").click()
    await confirmPrompt(page, /assign/i)
    await expect(page.getByText(/awb generated/i)).toBeVisible({ timeout: 20_000 })

    await page.getByTestId("packing-print-label-button").click()
    await confirmPrompt(page, /print|label/i)
    await expect(page.getByText(/label printed/i)).toBeVisible({ timeout: 20_000 })

    await page.getByTestId("packing-ready-to-ship-button").click()
    await confirmPrompt(page, /ready|ship/i)
    await expect(page.getByText(/pickup requested/i)).toBeVisible({ timeout: 20_000 })

    await page.getByTestId("packing-mark-shipped-button").click()
    await confirmPrompt(page, /ship/i)
    await expect(page.getByText(/^shipped$/i)).toBeVisible({ timeout: 10_000 })
  })

  test("delivery: synthesize the terminal tracking event and verify storefront reflects it", async ({
    page,
  }) => {
    test.skip(!displayId, "previous test didn't produce an order id")

    // Shiprocket has no real sandbox that can simulate an actual courier
    // handoff — this reuses the existing bump-order-status.ts script (already
    // used for this purpose in prod support/debugging) to inject the terminal
    // "Delivered" tracking event against the STAGING backend/DB only.
    bumpOrderStatus(displayId, "Delivered")

    await page.goto(`/in/order/${displayId}/confirmed`)
    await expect(page.getByText(/delivered/i)).toBeVisible({ timeout: 15_000 })
  })
})
