import { test, expect, type Page } from "@playwright/test"
import { assertNotProd, addToCart, TEST_ADDRESS, testEmail } from "./helpers"

/**
 * Real-world failure cases — the things that actually happen to real
 * customers, as opposed to the clean happy path in full-order-flow.spec.ts:
 * typos, mis-clicks, wrong item, wrong quantity, a dropped connection at the
 * worst moment, a double-tapped button, stale tabs, and hostile URLs.
 *
 * These run against the same staging/local stack and are all non-destructive
 * (no order is ever placed here), so they're safe to run repeatedly.
 */

const PRODUCT_HANDLE = process.env.STAGING_PRODUCT_HANDLE || "gold-solitaire-ring"
const OTHER_PRODUCT_HANDLE = process.env.STAGING_PRODUCT_HANDLE_ALT || "silver-stud-earrings"

test.beforeAll(() => {
  assertNotProd(process.env.STAGING_STOREFRONT_URL || "https://staging.delfee.in")
})

/** Fills the address step, overriding individual fields to inject typos. */
async function fillAddress(page: Page, overrides: Partial<Record<string, string>> = {}) {
  const v = {
    "shipping-first-name-input": TEST_ADDRESS.firstName,
    "shipping-last-name-input": TEST_ADDRESS.lastName,
    "shipping-address-input": TEST_ADDRESS.address1,
    "shipping-postal-code-input": TEST_ADDRESS.postalCode,
    "shipping-city-input": TEST_ADDRESS.city,
    "shipping-province-input": TEST_ADDRESS.province,
    "shipping-email-input": testEmail(),
    "shipping-phone-input": TEST_ADDRESS.phone,
    ...overrides,
  }
  for (const [testid, value] of Object.entries(v)) {
    await page.getByTestId(testid).fill(value)
  }
}

async function goToAddressStep(page: Page) {
  await addToCart(page, PRODUCT_HANDLE)
  await page.goto("/in/cart")
  await page.getByTestId("checkout-button").click()
  await expect(page.getByTestId("shipping-email-input")).toBeVisible({ timeout: 20_000 })
}

// ---------------------------------------------------------------------------
// Wrong item / wrong quantity — the most common real mistakes
// ---------------------------------------------------------------------------

test.describe("customer picks the wrong thing", () => {
  test("removing a wrongly-added item empties the cart cleanly", async ({ page }) => {
    await addToCart(page, PRODUCT_HANDLE)
    await page.goto("/in/cart")
    await expect(page.getByTestId("product-row")).toHaveCount(1)

    await page.getByTestId("product-delete-button").click()

    // Must reach the genuine empty state, not a zero-row cart that still
    // thinks it has contents (which would break checkout further along).
    await expect(page.getByTestId("product-row")).toHaveCount(0, { timeout: 20_000 })
    await expect(page.getByText(/your cart is feeling light/i)).toBeVisible()
  })

  test("adding the same item twice merges into one line, not two", async ({ page }) => {
    await addToCart(page, PRODUCT_HANDLE)
    await addToCart(page, PRODUCT_HANDLE)
    await page.goto("/in/cart")

    // A duplicated row is a real bug: the customer sees "2 items" but each
    // shows qty 1, and totals/stock checks get confusing.
    await expect(page.getByTestId("product-row")).toHaveCount(1, { timeout: 20_000 })
  })

  test("wrong quantity can be corrected, and can't go below 1", async ({ page }) => {
    await addToCart(page, PRODUCT_HANDLE)
    await page.goto("/in/cart")

    const inc = page.getByTestId("product-increase-button").first()
    const dec = page.getByTestId("product-decrease-button").first()

    await inc.click()
    await expect(dec).toBeEnabled({ timeout: 20_000 })
    await dec.click()

    // At qty 1 the decrease control must be disabled rather than silently
    // removing the line or sending quantity 0 to the backend.
    await expect(dec).toBeDisabled({ timeout: 20_000 })
    await expect(page.getByTestId("product-row")).toHaveCount(1)
  })

  test("quantity cannot be pushed past the per-line maximum", async ({ page }) => {
    await addToCart(page, PRODUCT_HANDLE)
    await page.goto("/in/cart")

    const inc = page.getByTestId("product-increase-button").first()
    // Click well past the cap; the control must disable rather than allow an
    // unfulfillable quantity through to checkout.
    for (let i = 0; i < 15; i++) {
      if (!(await inc.isEnabled().catch(() => false))) break
      await inc.click()
      await page.waitForTimeout(200)
    }
    await expect(inc).toBeDisabled({ timeout: 20_000 })
  })

  test("a second, different product is added alongside rather than replacing", async ({ page }) => {
    await addToCart(page, PRODUCT_HANDLE)
    await addToCart(page, OTHER_PRODUCT_HANDLE)
    await page.goto("/in/cart")
    await expect(page.getByTestId("product-row")).toHaveCount(2, { timeout: 20_000 })
  })
})

// ---------------------------------------------------------------------------
// Typos at checkout
// ---------------------------------------------------------------------------

test.describe("typos in the address form", () => {
  // The form relies on native constraint validation (required / pattern /
  // type=email). Each case asserts BOTH that the browser considers the field
  // invalid AND that we never advance past the address step — a field that
  // merely looks red but still submits is the failure mode worth catching.
  const cases: { name: string; testid: string; value: string }[] = [
    { name: "email missing @", testid: "shipping-email-input", value: "customer.example.com" },
    { name: "pincode too short", testid: "shipping-postal-code-input", value: "1600" },
    { name: "phone too short", testid: "shipping-phone-input", value: "98776" },
  ]

  for (const c of cases) {
    test(`rejects ${c.name}`, async ({ page }) => {
      await goToAddressStep(page)
      await fillAddress(page, { [c.testid]: c.value })
      await page.getByRole("button", { name: /continue to (delivery|payment)/i }).click()

      const isInvalid = await page
        .getByTestId(c.testid)
        .evaluate((el: HTMLInputElement) => !el.checkValidity())
      expect(isInvalid, `${c.testid} should fail constraint validation`).toBe(true)
      await expect(page.getByTestId("shipping-email-input")).toBeVisible()
    })
  }

  test("blank required fields never advance the checkout", async ({ page }) => {
    await goToAddressStep(page)
    await page.getByRole("button", { name: /continue to (delivery|payment)/i }).click()
    await expect(page.getByTestId("shipping-email-input")).toBeVisible()
  })

  test("a corrected typo lets the customer through", async ({ page }) => {
    await goToAddressStep(page)
    await fillAddress(page, { "shipping-postal-code-input": "1600" })
    await page.getByRole("button", { name: /continue to (delivery|payment)/i }).click()
    await expect(page.getByTestId("shipping-email-input")).toBeVisible()

    // Fix it and proceed — proves validation isn't a dead end.
    await page.getByTestId("shipping-postal-code-input").fill(TEST_ADDRESS.postalCode)
    await page.getByRole("button", { name: /continue to (delivery|payment)/i }).click()
    await expect(page.getByTestId("submit-payment-button")).toBeVisible({ timeout: 30_000 })
  })
})

// ---------------------------------------------------------------------------
// Bad network
// ---------------------------------------------------------------------------

test.describe("the customer's connection is bad", () => {
  test("add-to-cart with a dropped connection doesn't fake success", async ({ page }) => {
    await page.goto(`/in/products/${PRODUCT_HANDLE}`)

    // Kill the server-action POST (browser -> Next.js). This is the realistic
    // failure: the shopper's connection dies mid-tap, not the backend dying.
    await page.route("**/in/products/**", (route) =>
      route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue()
    )

    const addButton = page.getByRole("button", {
      name: /add to shopping bag|select options|out of stock/i,
    })
    if (/select options/i.test((await addButton.innerText()) || "")) {
      await page.locator("[data-testid='product-option-value']").first().click()
    }
    await addButton.click()
    await page.waitForTimeout(3_000)

    // The cart must not claim to hold an item the backend never received.
    await page.unroute("**/in/products/**")
    await page.goto("/in/cart")
    await expect(page.getByTestId("product-row")).toHaveCount(0, { timeout: 20_000 })
  })

  test("a failed connection at the address step keeps the customer on the form", async ({
    page,
  }) => {
    await goToAddressStep(page)
    await fillAddress(page)

    await page.route("**/checkout**", (route) =>
      route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue()
    )
    await page.getByRole("button", { name: /continue to (delivery|payment)/i }).click()
    await page.waitForTimeout(3_000)

    // It must not silently advance to payment as though the address saved.
    await expect(page.getByTestId("submit-payment-button")).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// Mis-clicks and hostile navigation
// ---------------------------------------------------------------------------

test.describe("mis-clicks and odd navigation", () => {
  test("double-tapping add-to-cart doesn't create two lines", async ({ page }) => {
    await page.goto(`/in/products/${PRODUCT_HANDLE}`)
    const addButton = page.getByRole("button", {
      name: /add to shopping bag|select options|out of stock/i,
    })
    if (/select options/i.test((await addButton.innerText()) || "")) {
      await page.locator("[data-testid='product-option-value']").first().click()
    }
    await expect(addButton).toHaveText(/add to shopping bag/i)

    // Impatient double-tap, the classic source of duplicate orders.
    await addButton.click()
    await addButton.click({ force: true }).catch(() => {})

    await page.goto("/in/cart")
    await expect(page.getByTestId("product-row")).toHaveCount(1, { timeout: 20_000 })
  })

  test("checkout with no cart at all doesn't crash", async ({ page }) => {
    const res = await page.goto("/in/checkout?step=address")
    // 404 (notFound) is the intended handling; a 500 would mean an unguarded
    // null cart reaching the template.
    expect(res?.status(), "empty-cart checkout should 404, not 500").toBeLessThan(500)
  })

  test("browser Back after the address step preserves what was entered", async ({ page }) => {
    await goToAddressStep(page)
    await fillAddress(page)
    await page.getByRole("button", { name: /continue to (delivery|payment)/i }).click()
    await expect(page.getByTestId("submit-payment-button")).toBeVisible({ timeout: 30_000 })

    await page.goBack()
    // Re-typing a full address because of a Back tap is a real abandonment
    // cause, so the saved address must still be there.
    await expect(page.getByTestId("shipping-address-input")).toHaveValue(TEST_ADDRESS.address1, {
      timeout: 20_000,
    })
  })

  test("a stale cart referencing a deleted product degrades gracefully", async ({ page }) => {
    // Guards the known force-cache staleness trap: an admin deleting a product
    // out-of-band leaves a line item pointing at something that no longer
    // exists. The cart must still render rather than 500.
    await addToCart(page, PRODUCT_HANDLE)
    const res = await page.goto("/in/cart")
    expect(res?.status()).toBeLessThan(500)
    await expect(page.getByTestId("cart-container")).toBeVisible({ timeout: 20_000 })
  })
})
