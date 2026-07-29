import { test, expect } from "@playwright/test"
import { TEST_ADDRESS, testEmail } from "./helpers"

// LIVE production smoke test — deliberately separate from full-order-flow.spec.ts
// (which targets staging). This places a REAL order with a REAL Razorpay
// charge on delfee.in, then walks admin packing far enough to prove the
// Shiprocket courier-selection/AWB logic works against the real account —
// and stops BEFORE "Ready to Ship", because that's the step that actually
// requests a real courier pickup (src/modules/shiprocket/service.ts
// requestPickup, wired to the "Mark as Ready to Ship" button). Immediately
// after AWB assignment it clicks "Reset Shipment" (the existing admin action
// that voids the AWB at Shiprocket), so no courier is ever dispatched.
//
// This test does NOT:
//   - auto-fill a real card (never store real card numbers in code/env) —
//     it opens the real Razorpay modal and waits for a human to complete
//     payment by hand. Run with `--headed`.
//   - cancel or refund the order/payment itself. That real charge and real
//     order need to be handled manually afterward (Razorpay dashboard +
//     admin), which the console output at the end of this test reminds you.
//
// Never wire this into CI or a schedule. Run it by hand, deliberately, when
// you actually want to spend real money verifying the live flow:
//
//   CONFIRM_LIVE_RUN=I-UNDERSTAND-THIS-CHARGES-REAL-MONEY \
//   LIVE_PRODUCT_HANDLE=<cheap-real-product-handle> \
//   LIVE_ADMIN_EMAIL=... LIVE_ADMIN_PASSWORD=... \
//   npx playwright test live-smoke-test.spec.ts --headed

const LIVE_STOREFRONT_URL = process.env.LIVE_STOREFRONT_URL || "https://delfee.in"
const LIVE_ADMIN_URL = process.env.LIVE_ADMIN_URL || "https://api.delfee.in"
const CONFIRM_TOKEN = "I-UNDERSTAND-THIS-CHARGES-REAL-MONEY"

test.describe("LIVE production smoke test (manual, real money)", () => {
  test.beforeAll(() => {
    if (process.env.CONFIRM_LIVE_RUN !== CONFIRM_TOKEN) {
      test.skip(
        true,
        `Refusing to run against live without explicit confirmation. ` +
          `Set CONFIRM_LIVE_RUN=${CONFIRM_TOKEN} to proceed — this will place ` +
          `a real order with a real Razorpay charge on ${LIVE_STOREFRONT_URL}.`
      )
    }
    if (!process.env.LIVE_PRODUCT_HANDLE) {
      throw new Error(
        "LIVE_PRODUCT_HANDLE is required — point it at a real, cheap, in-stock " +
          "product on the live store. There is no default on purpose."
      )
    }
    if (!process.env.LIVE_ADMIN_EMAIL || !process.env.LIVE_ADMIN_PASSWORD) {
      throw new Error("LIVE_ADMIN_EMAIL / LIVE_ADMIN_PASSWORD are required.")
    }
  })

  let displayId: string

  test("place a real order and pay manually via the real Razorpay checkout", async ({
    page,
  }) => {
    await page.goto(`${LIVE_STOREFRONT_URL}/in/products/${process.env.LIVE_PRODUCT_HANDLE}`)

    await page.getByRole("button", { name: /add to shopping bag/i }).click()
    await expect(page.getByText(/added to (your )?(bag|cart)/i)).toBeVisible({ timeout: 10_000 })

    await page.goto(`${LIVE_STOREFRONT_URL}/in/cart`)
    await page.getByRole("link", { name: /checkout|go to checkout/i }).click()

    await page.getByTestId("shipping-first-name-input").fill(TEST_ADDRESS.firstName)
    await page.getByTestId("shipping-last-name-input").fill(TEST_ADDRESS.lastName)
    await page.getByTestId("shipping-address-input").fill(TEST_ADDRESS.address1)
    await page.getByTestId("shipping-postal-code-input").fill(TEST_ADDRESS.postalCode)
    await page.getByTestId("shipping-city-input").fill(TEST_ADDRESS.city)
    await page.getByTestId("shipping-province-input").fill(TEST_ADDRESS.province)
    // Use YOUR OWN real, reachable email here via LIVE_TEST_EMAIL if you want
    // to see the real confirmation email land — never itservices007ak@gmail.com.
    await page.getByTestId("shipping-email-input").fill(process.env.LIVE_TEST_EMAIL || testEmail())
    await page.getByTestId("shipping-phone-input").fill(TEST_ADDRESS.phone)
    await page.getByRole("button", { name: /continue to (delivery|payment)/i }).click()

    await page.getByText(/razorpay \(upi \/ cards \/ wallets\)/i).click()
    await page.getByTestId("submit-payment-button").click()

    await page.getByTestId("terms-agree-checkbox").click()
    await page.getByTestId("submit-order-button").click()

    // Real Razorpay modal — complete this by hand in the opened browser
    // window (card, UPI, whatever you actually want to pay with). No
    // automation here, deliberately.
    console.log(
      "\n>>> Complete the REAL Razorpay payment by hand in the browser window now. " +
        "Waiting up to 3 minutes...\n"
    )
    await expect(page.getByTestId("order-complete-container")).toBeVisible({ timeout: 180_000 })

    const orderIdText = await page.getByTestId("order-complete-container").innerText()
    const match = orderIdText.match(/#(\d+)/)
    expect(match, "couldn't find an order display_id on the confirmation page").toBeTruthy()
    displayId = match![1]
    console.log(`>>> Live order #${displayId} placed with a REAL payment.`)
  })

  test("admin assigns AWB against the real Shiprocket account, then voids it before pickup", async ({
    page,
  }) => {
    test.skip(!displayId, "previous test didn't produce an order id")

    await page.goto(`${LIVE_ADMIN_URL}/app/login`)
    await page.getByLabel(/email/i).fill(process.env.LIVE_ADMIN_EMAIL!)
    await page.getByLabel(/password/i).fill(process.env.LIVE_ADMIN_PASSWORD!)
    await page.getByRole("button", { name: /log in|sign in/i }).click()

    await page.goto(`${LIVE_ADMIN_URL}/app/packing`)

    // Live must NOT be in simulate mode — this run only makes sense if it's
    // exercising the real Shiprocket courier-ranking/AWB logic.
    await expect(page.getByTestId("packing-simulate-banner")).toHaveCount(0)

    const row = page.getByTestId("packing-queue-row").filter({ hasText: `#${displayId}` })
    await row.click()
    await expect(page.getByTestId("packing-drawer-title")).toContainText(`#${displayId}`)

    await page.getByTestId("packing-start-button").click()

    for (const cb of await page.getByTestId("packing-item-checkbox").all()) {
      if (!(await cb.isChecked())) await cb.click()
    }

    await page.getByTestId("packing-assign-awb-button").click()
    await expect(page.getByText(/awb generated/i)).toBeVisible({ timeout: 20_000 })
    console.log(">>> Real AWB assigned via the real Shiprocket courier-ranking logic.")

    // STOP HERE. Do not click "Mark as Ready to Ship" — that's what requests
    // a real courier pickup. Void the AWB immediately instead.
    await page.getByRole("button", { name: /reset shipment/i }).click()
    // resetShipment (page.tsx) opens a confirm prompt first.
    await page.getByRole("button", { name: /reset shipment/i }).click()
    await expect(page.getByText(/awb generated/i)).toHaveCount(0, { timeout: 20_000 })

    console.log(
      `\n>>> AWB voided at Shiprocket — no courier was ever requested for order #${displayId}.\n` +
        `>>> The order itself and its REAL Razorpay payment are still live. ` +
        `Cancel/refund order #${displayId} manually (Razorpay dashboard + admin) ` +
        `if you don't want it to stay as a real order.\n`
    )
  })
})
