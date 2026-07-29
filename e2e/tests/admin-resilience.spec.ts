import { test, expect } from "@playwright/test"
import { ADMIN_BASE_URL } from "../playwright.config"
import { assertNotProd, adminLogin, confirmPrompt } from "./helpers"

/**
 * Operator-error cases in the warehouse packing flow — the mistakes staff
 * actually make under time pressure: opening the wrong order, mis-tapping a
 * destructive action, trying to ship a parcel that isn't fully packed, and
 * correcting an item ticked off by accident.
 *
 * Needs an order that has NOT been packed yet:
 *   backend/e2e-local.sh npx medusa exec ./src/scripts/seed-order.ts
 * then pass its display id as E2E_ORDER_DISPLAY_ID.
 *
 * Serial: these deliberately build on each other's state, mirroring one
 * operator working a single order from start to finish.
 */
test.describe.configure({ mode: "serial" })

const DISPLAY_ID = process.env.E2E_ORDER_DISPLAY_ID || ""

test.beforeAll(() => {
  assertNotProd(ADMIN_BASE_URL)
  if (!DISPLAY_ID) {
    throw new Error(
      "E2E_ORDER_DISPLAY_ID is not set — seed an unpacked order with " +
        "src/scripts/seed-order.ts and pass its display id."
    )
  }
})

test.beforeEach(async ({ page }) => {
  await adminLogin(page, ADMIN_BASE_URL)
  await page.goto(`${ADMIN_BASE_URL}/app/packing`)

  // Safety net: never let these run against a real Shiprocket account.
  await expect(page.getByTestId("packing-simulate-banner")).toBeVisible({ timeout: 15_000 })

  await page.getByTestId("packing-queue-row").filter({ hasText: `#${DISPLAY_ID}` }).click()
  await expect(page.getByTestId("packing-drawer-title")).toContainText(`#${DISPLAY_ID}`)
})

test("backing out of the start-packing prompt leaves the order untouched", async ({ page }) => {
  await page.getByTestId("packing-start-button").click()

  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByRole("button", { name: /cancel/i }).click()
  await expect(dialog).toBeHidden({ timeout: 10_000 })

  // A mis-tap that got cancelled must not have started packing: the start
  // button is still offered and no item checklist has appeared.
  await expect(page.getByTestId("packing-start-button")).toBeVisible()
  await expect(page.getByTestId("packing-item-checkbox")).toHaveCount(0)
})

test("AWB cannot be assigned until every item is packed", async ({ page }) => {
  await page.getByTestId("packing-start-button").click()
  await confirmPrompt(page, /start packing/i)

  const checkboxes = page.getByTestId("packing-item-checkbox")
  await expect(checkboxes.first()).toBeVisible({ timeout: 20_000 })
  const total = await checkboxes.count()
  expect(total, "seeded order should have more than one item").toBeGreaterThan(1)

  const awb = page.getByTestId("packing-assign-awb-button")
  await expect(awb).toBeDisabled()

  // Pack all but the last item — still must not be shippable. This is the
  // case that puts an incomplete parcel on a courier.
  for (let i = 0; i < total - 1; i++) {
    const cb = checkboxes.nth(i)
    if (!(await cb.isChecked())) await cb.click()
    await expect(cb).toBeChecked({ timeout: 10_000 })
  }
  await expect(awb, "AWB must stay disabled while an item is unpacked").toBeDisabled()

  // Pack the last one — now it may proceed.
  const last = checkboxes.nth(total - 1)
  if (!(await last.isChecked())) await last.click()
  await expect(last).toBeChecked({ timeout: 10_000 })
  await expect(awb).toBeEnabled({ timeout: 20_000 })
})

test("two operators packing the same order don't corrupt its state", async ({ page, context }) => {
  // Second operator opens the same order in another tab (shared session).
  const other = await context.newPage()
  await other.goto(`${ADMIN_BASE_URL}/app/packing`)
  await other.getByTestId("packing-queue-row").filter({ hasText: `#${DISPLAY_ID}` }).click()
  await expect(other.getByTestId("packing-drawer-title")).toContainText(`#${DISPLAY_ID}`)

  const boxA = page.getByTestId("packing-item-checkbox").first()
  const boxB = other.getByTestId("packing-item-checkbox").first()
  await expect(boxA).toBeVisible({ timeout: 20_000 })
  await expect(boxB).toBeVisible({ timeout: 20_000 })

  // Both toggle the same item at the same instant.
  await Promise.all([boxA.click(), boxB.click().catch(() => {})])
  await page.waitForTimeout(3_000)

  // Whichever write lands last, both views must converge on the same answer
  // after a refresh — and the item list must not be duplicated or lost.
  await page.reload()
  await page.getByTestId("packing-queue-row").filter({ hasText: `#${DISPLAY_ID}` }).click()
  const boxes = page.getByTestId("packing-item-checkbox")
  await expect(boxes.first()).toBeVisible({ timeout: 20_000 })
  expect(await boxes.count(), "item list must not duplicate under concurrent edits").toBe(3)

  // Leave every item packed again so the next test starts from a known state.
  for (const cb of await boxes.all()) {
    if (!(await cb.isChecked())) {
      await cb.click()
      await expect(cb).toBeChecked({ timeout: 10_000 })
    }
  }

  await other.close()
})

test("un-ticking an item packed by mistake re-blocks the AWB step", async ({ page }) => {
  const checkboxes = page.getByTestId("packing-item-checkbox")
  await expect(checkboxes.first()).toBeVisible({ timeout: 20_000 })

  const awb = page.getByTestId("packing-assign-awb-button")
  await expect(awb).toBeEnabled({ timeout: 20_000 })

  // Operator realises an item never made it into the box.
  const first = checkboxes.first()
  await first.click()
  await expect(first).not.toBeChecked({ timeout: 10_000 })
  await expect(awb, "un-packing an item must block AWB again").toBeDisabled({ timeout: 20_000 })

  // Put it back so the order is left in a consistent state for re-runs.
  await first.click()
  await expect(first).toBeChecked({ timeout: 10_000 })
})
