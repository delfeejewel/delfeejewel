import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  addToCartWorkflow,
  deleteLineItemsWorkflow,
} from "@medusajs/medusa/core-flows"

import { codFeeBandFor, codAllowed, codMaxOrderValue } from "../../../../../utils/cod"

const COD_FEE_HANDLE = "cod-fee"

/**
 * POST /store/carts/:id/cod-fee
 * Body: { enabled: boolean }
 *
 * Toggles the ₹50 Cash-on-Delivery handling fee on a cart — mirrors
 * /store/carts/:id/gift-wrap exactly. The storefront calls this with
 * enabled: isCod(selectedPaymentMethod) whenever the customer confirms a
 * payment method at checkout, so the fee is present precisely when (and
 * only when) COD is the chosen method — including for the COD-with-upfront-
 * token flow, since the token is a % of cart.total and must be computed
 * AFTER this fee is added.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id
  const { enabled } = (req.body || {}) as { enabled?: boolean }

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ message: "Body must include enabled: boolean" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const cartModule: any = req.scope.resolve(Modules.CART)

  const { data: products } = await query.graph({
    entity: "product",
    filters: { handle: COD_FEE_HANDLE },
    fields: ["id", "variants.id", "variants.sku"],
  })
  const feeProduct = (products as any[])?.[0]
  const feeVariants: any[] = feeProduct?.variants || []
  if (!feeVariants.length) {
    return res.status(500).json({
      message:
        "COD fee product not seeded. Run: npx medusa exec ./src/scripts/seed-cod-fee-product.ts",
    })
  }
  const feeVariantIds = new Set(feeVariants.map((v) => v.id))

  const { data: carts } = await query.graph({
    entity: "cart",
    filters: { id: cartId },
    fields: ["id", "metadata", "items.id", "items.variant_id", "items.total"],
  })
  const cart = (carts as any[])?.[0]
  if (!cart) return res.status(404).json({ message: "Cart not found" })

  // Any COD fee line already on the cart — there should only ever be one, but
  // tolerate several so a stale band can't wedge the cart.
  const existingFeeLines = ((cart.items as any[]) || []).filter((it) =>
    feeVariantIds.has(it.variant_id)
  )

  // Band on merchandise value EXCLUDING the fee itself, or adding the fee
  // could tip the cart into the next band and oscillate.
  const merchandiseValue = ((cart.items as any[]) || [])
    .filter((it) => !feeVariantIds.has(it.variant_id))
    .reduce((s, it) => s + (Number(it.total) || 0), 0)

  if (enabled && !codAllowed(merchandiseValue)) {
    return res.status(400).json({
      message:
        `Cash on Delivery isn't available on orders above ₹${codMaxOrderValue().toLocaleString("en-IN")}. ` +
        `Please choose an online payment method.`,
      cod_available: false,
      cod_max_order_value: codMaxOrderValue(),
    })
  }

  const band = enabled ? codFeeBandFor(merchandiseValue) : null
  const wanted = band
    ? feeVariants.find((v) => v.sku === band.sku) || feeVariants[0]
    : null

  try {
    if (enabled && wanted) {
      // Drop any fee line that isn't the band we want (wrong band, or dupes).
      const stale = existingFeeLines.filter((it) => it.variant_id !== wanted.id)
      if (stale.length) {
        await deleteLineItemsWorkflow(req.scope as any).run({
          input: { ids: stale.map((it) => it.id), cart_id: cartId } as any,
        })
      }
      if (!existingFeeLines.some((it) => it.variant_id === wanted.id)) {
        await addToCartWorkflow(req.scope as any).run({
          input: {
            cart_id: cartId,
            items: [{ variant_id: wanted.id, quantity: 1 }],
          },
        })
      }
    } else if (existingFeeLines.length) {
      await deleteLineItemsWorkflow(req.scope as any).run({
        input: {
          ids: existingFeeLines.map((it) => it.id),
          cart_id: cartId,
        } as any,
      })
    }

    const meta = (cart.metadata as any) || {}
    await cartModule.updateCarts([
      { id: cartId, metadata: { ...meta, cod_fee: enabled } },
    ])

    return res.json({
      ok: true,
      cod_fee: enabled,
      cod_fee_amount: band?.amount ?? 0,
      cod_available: true,
    })
  } catch (e: any) {
    return res.status(500).json({
      message: e?.message || "Could not toggle COD fee",
    })
  }
}
