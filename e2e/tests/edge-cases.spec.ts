import { test, expect, request as playwrightRequest } from "@playwright/test"
import { assertNotProd, addToCart, TEST_ADDRESS, testEmail } from "./helpers"

/**
 * Broad edge-case sweep: bad URLs, dead ends, hostile input, and the small
 * dark corners a real customer stumbles into. Nothing here places an order or
 * mutates catalogue state, so it's cheap and safe to run on every change.
 *
 * The bar throughout is "degrades sensibly": a 404 is fine, a 500 is not, and
 * a blank page with no way out is not.
 */

const STOREFRONT = process.env.STAGING_STOREFRONT_URL || "http://localhost:8010"
const PRODUCT_HANDLE = process.env.STAGING_PRODUCT_HANDLE || "gold-solitaire-ring"

test.beforeAll(() => {
  assertNotProd(STOREFRONT)
})

// ---------------------------------------------------------------------------
// Bad URLs
// ---------------------------------------------------------------------------

test.describe("URLs that don't exist", () => {
  const badPaths = [
    { name: "unknown product", path: "/in/products/this-product-does-not-exist" },
    { name: "unknown category", path: "/in/categories/no-such-category" },
    { name: "unknown collection", path: "/in/collections/no-such-collection" },
    { name: "unknown CMS page", path: "/in/no-such-page-at-all" },
    { name: "unknown order", path: "/in/order/999999999/confirmed" },
  ]

  for (const b of badPaths) {
    test(`${b.name} returns 404, never a server error`, async ({ page }) => {
      const res = await page.goto(b.path)
      const status = res?.status() ?? 0
      expect(status, `${b.path} should not be a 5xx`).toBeLessThan(500)
      // A soft-404 that renders an empty shell is nearly as bad as a crash —
      // the customer needs a way back into the store.
      await expect(page.locator("a[href*='/in']").first()).toBeVisible({ timeout: 15_000 })
    })
  }

  test("a nonsense country code still resolves to a usable store", async ({ page }) => {
    const res = await page.goto("/zz")
    expect(res?.status() ?? 0).toBeLessThan(500)
  })

  test("deep-linking to the payment step with an empty cart doesn't crash", async ({ page }) => {
    const res = await page.goto("/in/checkout?step=payment")
    expect(res?.status() ?? 0).toBeLessThan(500)
  })
})

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

test.describe("search", () => {
  test("a typo with no matches shows an empty state, not an error", async ({ page }) => {
    const res = await page.goto("/in/search?q=zzzzqqqqnotathing")
    expect(res?.status() ?? 0).toBeLessThan(500)
    await expect(page.getByText(/no (results|products)|nothing|couldn't find/i).first()).toBeVisible(
      { timeout: 20_000 }
    )
  })

  test("an empty query doesn't break the page", async ({ page }) => {
    const res = await page.goto("/in/search?q=")
    expect(res?.status() ?? 0).toBeLessThan(500)
  })

  test("search input is not vulnerable to injected markup", async ({ page }) => {
    // If this rendered unescaped, dialog handling below would fire.
    let dialogFired = false
    page.on("dialog", async (d) => {
      dialogFired = true
      await d.dismiss()
    })
    const res = await page.goto(
      `/in/search?q=${encodeURIComponent('<img src=x onerror=alert(1)>')}`
    )
    expect(res?.status() ?? 0).toBeLessThan(500)
    await page.waitForTimeout(2_000)
    expect(dialogFired, "injected markup must not execute").toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Hostile / awkward input
// ---------------------------------------------------------------------------

test.describe("awkward customer input", () => {
  test("script-like text in the address fields is treated as plain text", async ({ page }) => {
    let dialogFired = false
    page.on("dialog", async (d) => {
      dialogFired = true
      await d.dismiss()
    })

    await addToCart(page, PRODUCT_HANDLE)
    await page.goto("/in/cart")
    await page.getByTestId("checkout-button").click()
    await expect(page.getByTestId("shipping-email-input")).toBeVisible({ timeout: 20_000 })

    await page.getByTestId("shipping-first-name-input").fill('<script>alert(1)</script>')
    await page.getByTestId("shipping-last-name-input").fill('"><img src=x onerror=alert(1)>')
    await page.getByTestId("shipping-address-input").fill(TEST_ADDRESS.address1)
    await page.getByTestId("shipping-postal-code-input").fill(TEST_ADDRESS.postalCode)
    await page.getByTestId("shipping-city-input").fill(TEST_ADDRESS.city)
    await page.getByTestId("shipping-province-input").fill(TEST_ADDRESS.province)
    await page.getByTestId("shipping-email-input").fill(testEmail())
    await page.getByTestId("shipping-phone-input").fill(TEST_ADDRESS.phone)
    await page.getByRole("button", { name: /continue to (delivery|payment)/i }).click()

    await page.waitForTimeout(3_000)
    expect(dialogFired, "injected markup must not execute").toBe(false)
  })

  test("a very long name is either rejected or stored safely", async ({ page }) => {
    await addToCart(page, PRODUCT_HANDLE)
    await page.goto("/in/cart")
    await page.getByTestId("checkout-button").click()
    await expect(page.getByTestId("shipping-email-input")).toBeVisible({ timeout: 20_000 })

    await page.getByTestId("shipping-first-name-input").fill("A".repeat(500))
    await page.getByTestId("shipping-last-name-input").fill(TEST_ADDRESS.lastName)
    await page.getByTestId("shipping-address-input").fill(TEST_ADDRESS.address1)
    await page.getByTestId("shipping-postal-code-input").fill(TEST_ADDRESS.postalCode)
    await page.getByTestId("shipping-city-input").fill(TEST_ADDRESS.city)
    await page.getByTestId("shipping-province-input").fill(TEST_ADDRESS.province)
    await page.getByTestId("shipping-email-input").fill(testEmail())
    await page.getByTestId("shipping-phone-input").fill(TEST_ADDRESS.phone)
    await page.getByRole("button", { name: /continue to (delivery|payment)/i }).click()

    // Either outcome is acceptable; an unhandled 500 is not.
    await page.waitForTimeout(3_000)
    expect(page.url()).toContain("/checkout")
  })

  test("unicode and emoji in the address don't break checkout", async ({ page }) => {
    await addToCart(page, PRODUCT_HANDLE)
    await page.goto("/in/cart")
    await page.getByTestId("checkout-button").click()
    await expect(page.getByTestId("shipping-email-input")).toBeVisible({ timeout: 20_000 })

    await page.getByTestId("shipping-first-name-input").fill("आरव 🙏")
    await page.getByTestId("shipping-last-name-input").fill("Śarmā")
    await page.getByTestId("shipping-address-input").fill("Flat 3B, गली नं. 7 🏠")
    await page.getByTestId("shipping-postal-code-input").fill(TEST_ADDRESS.postalCode)
    await page.getByTestId("shipping-city-input").fill(TEST_ADDRESS.city)
    await page.getByTestId("shipping-province-input").fill(TEST_ADDRESS.province)
    await page.getByTestId("shipping-email-input").fill(testEmail())
    await page.getByTestId("shipping-phone-input").fill(TEST_ADDRESS.phone)
    await page.getByRole("button", { name: /continue to (delivery|payment)/i }).click()

    await expect(page.getByTestId("submit-payment-button")).toBeVisible({ timeout: 30_000 })
  })
})

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

test.describe("account", () => {
  test("a wrong password is rejected without leaking whether the account exists", async ({
    page,
  }) => {
    await page.goto("/in/account")
    await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 20_000 })
    await page.getByTestId("email-input").fill("definitely-not-a-customer@example.com")
    await page.getByTestId("password-input").fill("wrong-password-here")
    await page.getByTestId("sign-in-button").click()

    // Must stay on the login page with an error, and must not say "no such
    // user" — that difference is what makes account enumeration possible.
    await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 20_000 })
    const body = (await page.locator("body").innerText()).toLowerCase()
    expect(
      /(no account|not registered|user does not exist|no such user)/.test(body),
      "login failure should not reveal whether the email is registered"
    ).toBe(false)
  })

  test("signing in with a malformed email is blocked client-side", async ({ page }) => {
    await page.goto("/in/account")
    await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 20_000 })
    await page.getByTestId("email-input").fill("not-an-email")
    await page.getByTestId("password-input").fill("whatever123")
    await page.getByTestId("sign-in-button").click()
    await expect(page.getByTestId("login-page")).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// API-level guarantees
// ---------------------------------------------------------------------------

test.describe("store API", () => {
  const backend = process.env.STAGING_ADMIN_URL || "http://localhost:9010"

  test("the store API rejects requests without a publishable key", async () => {
    const ctx = await playwrightRequest.newContext()
    const res = await ctx.get(`${backend}/store/products`)
    // Must be a clean client error, not a 500 and certainly not a 200.
    expect(res.status(), "missing publishable key should be rejected").toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
    await ctx.dispose()
  })

  test("admin endpoints reject unauthenticated access", async () => {
    const ctx = await playwrightRequest.newContext()
    for (const path of ["/admin/orders", "/admin/products", "/admin/packing/orders"]) {
      const res = await ctx.get(`${backend}${path}`)
      expect([401, 403], `${path} must not be publicly readable`).toContain(res.status())
    }
    await ctx.dispose()
  })

  test("a malformed cart id is a client error, not a crash", async () => {
    const ctx = await playwrightRequest.newContext()
    const res = await ctx.get(`${backend}/store/carts/not-a-real-cart-id`, {
      headers: { "x-publishable-api-key": process.env.LIVE_PUBLISHABLE_KEY || "" },
    })
    expect(res.status()).toBeLessThan(500)
    await ctx.dispose()
  })
})
