/**
 * Weekly automated LIVE smoke test — no browser, no card data, ever.
 *
 * Talks directly to the real production HTTP APIs (same routes the real
 * storefront/admin UI call) to: create a cart for the dedicated ₹1 test
 * product → initiate a Razorpay payment session (same as real checkout) →
 * charge it server-side via the pre-saved token through the admin-only
 * charge-and-complete route → pack + assign a REAL Shiprocket AWB → void it
 * immediately (never requests pickup, so no courier is ever dispatched) →
 * cancel the order, which auto-refunds the ₹1 charge → verifies the refund
 * actually went through.
 *
 * Every step is checked. Any failure — including a refund that didn't
 * actually happen — exits non-zero so CI fails loudly rather than silently
 * leaving a real charge unrefunded.
 *
 * Set LIVE_SMOKE_DRY_RUN=true to stop before the charge — verifies creds,
 * variant id, region/shipping config and connectivity for ₹0. Use it first.
 *
 * Run with: npx tsx e2e/live-weekly-smoke.ts
 * (or `node --loader ts-node/esm` / compiled — see package.json "smoke" script)
 */

const STOREFRONT_URL = required("LIVE_STOREFRONT_URL")
const ADMIN_URL = required("LIVE_ADMIN_URL")
const PUBLISHABLE_KEY = required("LIVE_PUBLISHABLE_KEY")
const VARIANT_ID = required("LIVE_SMOKE_TEST_VARIANT_ID")
const TEST_EMAIL = required("LIVE_SMOKE_TEST_EMAIL")
const ADMIN_EMAIL = required("LIVE_SMOKE_ADMIN_EMAIL")
const ADMIN_PASSWORD = required("LIVE_SMOKE_ADMIN_PASSWORD")

/**
 * Dry run: do everything up to (but NOT including) the charge — admin login,
 * cart creation, address, shipping option, Razorpay payment session. Verifies
 * credentials, the variant id, region/shipping config, and connectivity for
 * ₹0. Leaves behind one abandoned cart on live, which is harmless (real
 * shoppers abandon carts constantly) and no order, payment, or fulfillment.
 */
const DRY_RUN = process.env.LIVE_SMOKE_DRY_RUN === "true"
const TOTAL = DRY_RUN ? 3 : 7
const step = (n: number, msg: string) => console.log(`${n}/${TOTAL} ${msg}`)

const PROD_HOSTS_ONLY = ["delfee.in", "api.delfee.in"]

function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env var ${name}`)
    process.exit(1)
  }
  return v
}

function assertLiveHost(url: string) {
  const host = new URL(url).host
  if (!PROD_HOSTS_ONLY.includes(host)) {
    fail(`Refusing to run — ${host} is not the live host. This script only targets production.`)
  }
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

async function req(url: string, opts: RequestInit & { auth?: string } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as any),
  }
  if (opts.auth) headers["Authorization"] = `Bearer ${opts.auth}`
  const r = await fetch(url, { ...opts, headers })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) {
    throw new Error(`${opts.method || "GET"} ${url} -> ${r.status}: ${body?.message || JSON.stringify(body)}`)
  }
  return body
}

async function main() {
  assertLiveHost(STOREFRONT_URL)
  assertLiveHost(ADMIN_URL)

  if (DRY_RUN) {
    console.log("DRY RUN — will stop before charging. No money will move.\n")
  }

  step(1, "Logging into admin...")
  const { token } = await req(`${ADMIN_URL}/auth/user/emailpass`, {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  if (!token) fail("Admin login did not return a token")

  step(2, "Creating cart with the ₹1 test product...")
  const storeHeaders = { "x-publishable-api-key": PUBLISHABLE_KEY }
  const { regions } = await req(`${STOREFRONT_URL}/store/regions`, { headers: storeHeaders as any })
  const region = (regions || []).find((r: any) =>
    (r.countries || []).some((c: any) => c.iso_2 === "in")
  )
  if (!region) fail("Could not find an India region on the live store")

  const { cart } = await req(`${STOREFRONT_URL}/store/carts`, {
    method: "POST",
    headers: storeHeaders as any,
    body: JSON.stringify({ region_id: region.id, email: TEST_EMAIL }),
  })

  await req(`${STOREFRONT_URL}/store/carts/${cart.id}/line-items`, {
    method: "POST",
    headers: storeHeaders as any,
    body: JSON.stringify({ variant_id: VARIANT_ID, quantity: 1 }),
  })

  await req(`${STOREFRONT_URL}/store/carts/${cart.id}`, {
    method: "POST",
    headers: storeHeaders as any,
    body: JSON.stringify({
      email: TEST_EMAIL,
      shipping_address: {
        first_name: "Automated",
        last_name: "Live Smoke Test",
        address_1: "123 Test Lane",
        city: "Chandigarh",
        postal_code: "160001",
        province: "Chandigarh",
        country_code: "in",
        phone: "9999999999",
      },
    }),
  })

  const { shipping_options } = await req(
    `${STOREFRONT_URL}/store/shipping-options?cart_id=${cart.id}`,
    { headers: storeHeaders as any }
  )
  if (!shipping_options?.length) fail("No shipping options available for this cart")
  await req(`${STOREFRONT_URL}/store/carts/${cart.id}/shipping-methods`, {
    method: "POST",
    headers: storeHeaders as any,
    body: JSON.stringify({ option_id: shipping_options[0].id }),
  })

  step(3, "Initiating Razorpay payment session (same as real checkout)...")
  const { payment_collection } = await req(`${STOREFRONT_URL}/store/payment-collections`, {
    method: "POST",
    headers: storeHeaders as any,
    body: JSON.stringify({ cart_id: cart.id }),
  })
  await req(
    `${STOREFRONT_URL}/store/payment-collections/${payment_collection.id}/payment-sessions`,
    {
      method: "POST",
      headers: storeHeaders as any,
      body: JSON.stringify({ provider_id: "pp_razorpay_razorpay" }),
    }
  )

  // Safety assertion, checked before any money moves: live must NOT be
  // simulating Shiprocket, or the AWB step below would prove nothing.
  const { simulate } = await req(`${ADMIN_URL}/admin/packing/orders`, { auth: token })
  if (simulate) fail("Refusing to proceed — SHIPROCKET_SIMULATE is on for this environment")

  if (DRY_RUN) {
    console.log(
      `\n✓ Dry run passed: admin login, ₹1 variant, India region, shipping option, ` +
        `and Razorpay session all OK; live is not simulating Shiprocket.\n` +
        `  Nothing was charged. Cart ${cart.id} is left abandoned (harmless).\n` +
        `  Not covered by a dry run: the tokenized charge, real AWB assignment/void, ` +
        `and the cancel+refund path — those need a real run.\n`
    )
    return
  }

  step(4, "Charging the pre-saved token server-side and completing the order...")
  const charge = await req(`${ADMIN_URL}/admin/automation/live-smoke/charge-and-complete`, {
    method: "POST",
    auth: token,
    body: JSON.stringify({ cart_id: cart.id }),
  })
  const displayId = charge.display_id
  const orderId = charge.order_id
  console.log(`   -> Live order #${displayId} created (real ₹1 charge captured).`)

  step(5, "Assigning a REAL Shiprocket AWB, then voiding it immediately...")
  const { orders: queue } = await req(`${ADMIN_URL}/admin/packing/orders`, { auth: token })
  const row = (queue || []).find((o: any) => o.id === orderId)
  if (!row) fail(`Order ${orderId} not found in the packing queue`)

  await req(`${ADMIN_URL}/admin/packing/orders/${orderId}/start`, { method: "POST", auth: token })
  const detail = await req(`${ADMIN_URL}/admin/packing/orders/${orderId}`, { auth: token })
  for (const item of detail.items || []) {
    await req(`${ADMIN_URL}/admin/packing/orders/${orderId}/items/${item.id}`, {
      method: "POST",
      auth: token,
      body: JSON.stringify({ packed: true }),
    })
  }

  const afterPack = await req(`${ADMIN_URL}/admin/packing/orders/${orderId}`, { auth: token })
  const fulfillmentId = afterPack.fulfillment?.id
  if (!fulfillmentId) fail("No fulfillment found after packing")

  await req(`${ADMIN_URL}/admin/orders/${orderId}/fulfillments/${fulfillmentId}/shiprocket`, {
    method: "POST",
    auth: token,
    body: JSON.stringify({ action: "assign_awb" }),
  })
  const awbCheck = await req(`${ADMIN_URL}/admin/packing/orders/${orderId}`, { auth: token })
  if (!awbCheck.fulfillment?.awb_code) fail("AWB was not assigned — real Shiprocket courier-ranking may be broken")
  console.log(`   -> Real AWB assigned: ${awbCheck.fulfillment.awb_code}`)

  // STOP. Do not call "ready-to-ship"/request_pickup — that's what actually
  // dispatches a real courier. Void the AWB immediately instead.
  await req(`${ADMIN_URL}/admin/orders/${orderId}/fulfillments/${fulfillmentId}/shiprocket`, {
    method: "POST",
    auth: token,
    body: JSON.stringify({ action: "reset_shipment" }),
  })
  console.log("   -> AWB voided at Shiprocket. No courier was ever requested.")

  step(6, "Cancelling the order (auto-refunds the ₹1 charge)...")
  const cancelResult = await req(`${ADMIN_URL}/admin/orders/${orderId}/cancel-order`, {
    method: "POST",
    auth: token,
  })
  if (cancelResult.refund_warning) {
    fail(`Order cancelled but refund is NOT confirmed: ${cancelResult.refund_warning}`)
  }

  step(7, "Done.")
  console.log(
    `\n✓ Live order #${displayId}: charged, AWB assigned+voided, cancelled+refunded. All good.\n`
  )
}

main().catch((e) => fail(e?.message || String(e)))
