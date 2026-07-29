import { test, expect } from "@playwright/test"
import { assertNotProd, addToCart, setStock } from "./helpers"

/**
 * Stock races and multi-tab concurrency — the cases where the customer's view
 * of the world and the server's view drift apart: the last unit sells while
 * they're deciding, or they have the same cart open in two tabs.
 *
 * Stock is manipulated through the project's own set-stock.ts (service layer,
 * cache-busting) rather than SQL, because the inventory cache would otherwise
 * serve stale numbers and these tests would pass for the wrong reason.
 *
 * Serial: these share a product's stock level, so they must not interleave.
 */
test.describe.configure({ mode: "serial" })

// A product used exclusively for stock manipulation, so lowering it to 0 can't
// disturb the other suites, which use gold-solitaire-ring.
const STOCK_PRODUCT = process.env.E2E_STOCK_PRODUCT_HANDLE || "silver-oxidised-ring"
const CART_PRODUCT = process.env.STAGING_PRODUCT_HANDLE || "gold-solitaire-ring"

// A second product, used only for the sold-out case. It must be zeroed BEFORE
// anything in this run views it: src/lib/data/products.ts caches product data
// with `revalidate: 60`, so a product fetched while in stock keeps reporting
// the old inventory for up to a minute. (That staleness window is real
// production behaviour — a shopper can add a just-sold-out item and only find
// out at checkout, where Medusa's reservation is authoritative.)
const SOLDOUT_PRODUCT = process.env.E2E_SOLDOUT_PRODUCT_HANDLE || "silver-chain-bracelet"

const RESTORE_QTY = 1_000_000

test.beforeAll(() => {
  assertNotProd(process.env.STAGING_STOREFRONT_URL || "https://staging.delfee.in")
  setStock(SOLDOUT_PRODUCT, 0)
})

test.afterAll(() => {
  // Always hand the catalogue back in a usable state, even if a test failed.
  setStock(STOCK_PRODUCT, RESTORE_QTY)
  setStock(SOLDOUT_PRODUCT, RESTORE_QTY)
})

// ---------------------------------------------------------------------------
// Stock races
// ---------------------------------------------------------------------------

test.describe("stock runs low or runs out", () => {
  test("the quantity stepper is capped by real stock, not the generic max", async ({ page }) => {
    setStock(STOCK_PRODUCT, 3)

    await page.goto(`/in/products/${STOCK_PRODUCT}`)
    const addButton = page.getByRole("button", {
      name: /add to shopping bag|select options|out of stock/i,
    })
    await expect(addButton).toBeVisible({ timeout: 20_000 })
    if (/select options/i.test((await addButton.innerText()) || "")) {
      await page.locator("[data-testid='product-option-value']").first().click()
    }
    await expect(addButton).toHaveText(/add to shopping bag/i, { timeout: 10_000 })

    // The generic per-line cap is 10; with 3 in stock it must stop at 3,
    // otherwise the customer can buy stock that doesn't exist.
    const inc = page.getByTestId("product-qty-increase")
    await expect(inc).toBeVisible({ timeout: 10_000 })
    for (let i = 0; i < 9; i++) {
      if (!(await inc.isEnabled().catch(() => false))) break
      await inc.click()
      await page.waitForTimeout(150)
    }
    await expect(inc, "stepper must stop at available stock, not the generic cap of 10")
      .toBeDisabled({ timeout: 10_000 })
  })

  test("a low-stock product warns the customer", async ({ page }) => {
    setStock(STOCK_PRODUCT, 3)
    await page.goto(`/in/products/${STOCK_PRODUCT}`)
    const addButton = page.getByRole("button", {
      name: /add to shopping bag|select options|out of stock/i,
    })
    await expect(addButton).toBeVisible({ timeout: 20_000 })
    if (/select options/i.test((await addButton.innerText()) || "")) {
      await page.locator("[data-testid='product-option-value']").first().click()
    }
    // lowStock triggers at <= 5 units.
    await expect(page.getByText(/left|hurry|low stock|only/i).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test("a sold-out product cannot be added to the cart", async ({ page }) => {
    // Zeroed in beforeAll and never viewed since, so no stale cache entry.
    await page.goto(`/in/products/${SOLDOUT_PRODUCT}`)
    const addButton = page.getByRole("button", {
      name: /add to shopping bag|select options|out of stock/i,
    })
    await expect(addButton).toBeVisible({ timeout: 20_000 })
    if (/select options/i.test((await addButton.innerText()) || "")) {
      await page.locator("[data-testid='product-option-value']").first().click()
    }

    await expect(addButton).toHaveText(/out of stock/i, { timeout: 10_000 })
    await expect(addButton).toBeDisabled()
  })

  test("stock selling out while the item sits in the cart doesn't break the cart", async ({
    page,
  }) => {
    setStock(STOCK_PRODUCT, 5)
    await addToCart(page, STOCK_PRODUCT)

    // The last units sell to someone else while this customer deliberates.
    setStock(STOCK_PRODUCT, 0)

    const res = await page.goto("/in/cart")
    expect(res?.status(), "cart must not 500 when a line item went out of stock").toBeLessThan(500)
    await expect(page.getByTestId("cart-container")).toBeVisible({ timeout: 20_000 })

    // Whatever the policy (block, warn, or silently allow backorder), the page
    // must stay usable — a hard crash here strands the customer entirely.
    await expect(page.getByTestId("product-row")).toHaveCount(1)
  })
})

// ---------------------------------------------------------------------------
// Multi-tab concurrency (both tabs share one browser context => one cart)
// ---------------------------------------------------------------------------

test.describe("the same cart is open in two tabs", () => {
  test("adding from both tabs yields one line with the combined quantity", async ({ context }) => {
    const tabA = await context.newPage()
    await addToCart(tabA, CART_PRODUCT)

    const tabB = await context.newPage()
    await addToCart(tabB, CART_PRODUCT)

    await tabA.goto("/in/cart")
    // One line, not two, and the quantities must not have been lost.
    await expect(tabA.getByTestId("product-row")).toHaveCount(1, { timeout: 20_000 })
    await expect(tabA.getByText(/^2$/).first()).toBeVisible({ timeout: 20_000 })

    await tabA.close()
    await tabB.close()
  })

  test("a tab showing a cart that another tab emptied recovers on reload", async ({ context }) => {
    const tabA = await context.newPage()
    await addToCart(tabA, CART_PRODUCT)
    await tabA.goto("/in/cart")
    await expect(tabA.getByTestId("product-row")).toHaveCount(1, { timeout: 20_000 })

    const tabB = await context.newPage()
    await tabB.goto("/in/cart")
    await tabB.getByTestId("product-delete-button").click()
    await expect(tabB.getByTestId("product-row")).toHaveCount(0, { timeout: 20_000 })

    // Tab A is now stale. retrieveCart() is force-cached with `revalidate: 30`
    // as a safety net, so a single reload inside that window can still show the
    // removed item; it must reconcile once the window passes. Reload on each
    // poll so we're testing the server render, not just the DOM.
    await expect
      .poll(
        async () => {
          await tabA.reload()
          return tabA.getByTestId("product-row").count()
        },
        {
          timeout: 60_000,
          intervals: [2_000, 5_000, 5_000, 10_000, 10_000, 10_000, 10_000],
          message: "stale tab never reconciled to the emptied cart",
        }
      )
      .toBe(0)

    await tabA.close()
    await tabB.close()
  })

  test("concurrent quantity edits from two tabs don't corrupt the line", async ({ context }) => {
    const tabA = await context.newPage()
    await addToCart(tabA, CART_PRODUCT)
    await tabA.goto("/in/cart")
    await expect(tabA.getByTestId("product-row")).toHaveCount(1, { timeout: 20_000 })

    const tabB = await context.newPage()
    await tabB.goto("/in/cart")
    await expect(tabB.getByTestId("product-row")).toHaveCount(1, { timeout: 20_000 })

    // Both tabs press "+" at the same moment.
    await Promise.all([
      tabA.getByTestId("product-increase-button").first().click(),
      tabB.getByTestId("product-increase-button").first().click(),
    ])
    await tabA.waitForTimeout(3_000)

    // Last-write-wins is acceptable; a duplicated line or a crash is not.
    await tabA.reload()
    await expect(tabA.getByTestId("product-row")).toHaveCount(1, { timeout: 20_000 })
    const qty = await tabA
      .locator("[data-testid='product-row']")
      .first()
      .innerText()
    expect(qty, "quantity should have increased, not gone negative or blank").toMatch(/[1-9]/)

    await tabA.close()
    await tabB.close()
  })

  test("checking out from a tab whose cart was emptied elsewhere doesn't crash", async ({
    context,
  }) => {
    const tabA = await context.newPage()
    await addToCart(tabA, CART_PRODUCT)
    await tabA.goto("/in/cart")
    await expect(tabA.getByTestId("product-row")).toHaveCount(1, { timeout: 20_000 })

    const tabB = await context.newPage()
    await tabB.goto("/in/cart")
    await tabB.getByTestId("product-delete-button").click()
    await expect(tabB.getByTestId("product-row")).toHaveCount(0, { timeout: 20_000 })

    // Stale tab tries to check out a cart that no longer has anything in it.
    const res = await tabA.goto("/in/checkout?step=address")
    expect(res?.status(), "stale checkout should not 500").toBeLessThan(500)

    await tabA.close()
    await tabB.close()
  })
})
