import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import Razorpay from "razorpay"

/**
 * POST /store/cod-upfront/create-razorpay-order
 * Body: { cart_id }
 * Computes the COD-upfront amount for the cart (percent × total, but only if
 * total ≥ min_order) and creates a Razorpay order for that amount. Returns
 * the Razorpay order id + public key so the storefront can open the popup.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { cart_id } = (req.body || {}) as { cart_id?: string }
  if (!cart_id) {
    return res.status(400).json({ message: "cart_id is required" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: carts } = await query.graph({
    entity: "cart",
    filters: { id: cart_id },
    fields: ["id", "total", "currency_code"],
  })
  const cart = (carts as any[])?.[0]
  if (!cart) return res.status(404).json({ message: "Cart not found" })

  const total = Number(cart.total) || 0
  const percent = Number(process.env.COD_UPFRONT_PERCENT) || 5
  const minOrder = Number(process.env.COD_UPFRONT_MIN_ORDER) || 500

  if (total < minOrder) {
    return res.json({
      upfront_required: false,
      amount: 0,
      currency: cart.currency_code,
    })
  }

  // Compute upfront. Round to the nearest rupee.
  const upfrontAmount = Math.round((total * percent) / 100)
  if (upfrontAmount <= 0) {
    return res.json({
      upfront_required: false,
      amount: 0,
      currency: cart.currency_code,
    })
  }

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return res
      .status(500)
      .json({ message: "Razorpay is not configured on the server" })
  }

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
    const order = await razorpay.orders.create({
      amount: upfrontAmount * 100, // Razorpay expects paise
      currency: (cart.currency_code as string).toUpperCase(),
      receipt: `cod_upfront_${cart_id.slice(-16)}`,
      notes: {
        cart_id,
        type: "cod_upfront",
      },
    })

    return res.json({
      upfront_required: true,
      amount: upfrontAmount,
      currency: cart.currency_code,
      razorpay_order_id: order.id,
      razorpay_key_id: keyId,
    })
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Could not create Razorpay order" })
  }
}
