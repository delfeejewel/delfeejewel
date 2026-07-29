import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import Razorpay from "razorpay"

import { actorHasPermission } from "../../../../../../lib/rbac"

/**
 * POST /admin/automation/live-smoke/setup/confirm
 *
 * Second half of the one-time setup: verifies the signature Razorpay's
 * checkout.js returned after the admin's real card payment succeeded, then
 * fetches the payment to read back its `token_id` — the reusable saved-card
 * token the weekly live smoke test will charge from then on. Returned once,
 * here, for the admin to copy into the droplet's backend.env by hand as
 * RAZORPAY_LIVE_SMOKE_TOKEN_ID / RAZORPAY_LIVE_SMOKE_CUSTOMER_ID — never
 * stored automatically anywhere.
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

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, customer_id } =
    (req.body || {}) as {
      razorpay_order_id?: string
      razorpay_payment_id?: string
      razorpay_signature?: string
      customer_id?: string
    }
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !customer_id) {
    return res.status(400).json({ message: "Missing razorpay_* fields or customer_id" })
  }

  const crypto = require("crypto")
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex")
  const sigBuf = Buffer.from(razorpay_signature)
  const expBuf = Buffer.from(expected)
  const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)
  if (!valid) {
    return res.status(400).json({ message: "Invalid payment signature" })
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })

  try {
    const payment = await razorpay.payments.fetch(razorpay_payment_id)
    const tokenId = (payment as any).token_id
    if (!tokenId) {
      return res.status(422).json({
        message:
          "Payment succeeded but Razorpay did not return a token_id — the card " +
          "may not have been saved. Check that 'recurring' was enabled at checkout.",
      })
    }
    return res.json({ customer_id, token_id: tokenId })
  } catch (e: any) {
    return res.status(502).json({
      message: e?.error?.description || e?.message || "Could not fetch payment from Razorpay",
    })
  }
}
