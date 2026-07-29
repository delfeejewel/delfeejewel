import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import Razorpay from "razorpay"

import { actorHasPermission } from "../../../../../../lib/rbac"

/**
 * POST /admin/automation/live-smoke/setup/create-order
 *
 * ONE-TIME setup step, run by hand from the "Live Smoke Test Setup" admin
 * page (backend/src/admin/routes/live-smoke-setup/page.tsx). Creates (or
 * reuses) a dedicated Razorpay customer for the weekly live smoke test, then
 * a ₹1 recurring-enabled order for the admin to actually pay with their own
 * real card, once, in that page — Razorpay saves the card against this
 * customer and returns a token afterward (see setup/confirm/route.ts).
 *
 * Not gated on LIVE_SMOKE_TEST_ENABLED — that flag only controls the
 * recurring weekly CHARGE, not this one-time human-driven setup.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "orders.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return res.status(503).json({ message: "Razorpay is not configured on the server" })
  }

  const { email } = (req.body || {}) as { email?: string }
  if (!email) {
    return res.status(400).json({ message: "email is required (a dedicated automation inbox)" })
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

  let customerId = process.env.RAZORPAY_LIVE_SMOKE_CUSTOMER_ID
  if (!customerId) {
    try {
      const customer = await razorpay.customers.create({
        name: "Delfee Automated Live Smoke Test",
        email,
        fail_existing: 0,
      } as any)
      customerId = customer.id
    } catch (e: any) {
      return res.status(502).json({
        message: e?.error?.description || e?.message || "Could not create Razorpay customer",
      })
    }
  }

  try {
    const order = await razorpay.orders.create({
      amount: 100, // ₹1, in paise
      currency: "INR",
      payment_capture: true,
      notes: { purpose: "live_smoke_test_token_setup" },
    } as any)

    return res.json({
      key_id: keyId,
      customer_id: customerId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    })
  } catch (e: any) {
    return res.status(502).json({
      message: e?.error?.description || e?.message || "Could not create Razorpay order",
    })
  }
}
