import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  addToCartWorkflow,
  deleteLineItemsWorkflow,
} from "@medusajs/medusa/core-flows"

const COD_FEE_HANDLE = "cod-fee"
const COD_FEE_SKU = "COD-FEE-INR-50"

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
  const feeVariant =
    feeProduct?.variants?.find((v: any) => v.sku === COD_FEE_SKU) ||
    feeProduct?.variants?.[0]
  if (!feeVariant) {
    return res.status(500).json({
      message:
        "COD fee product not seeded. Run: npx medusa exec ./src/scripts/seed-cod-fee-product.ts",
    })
  }

  const { data: carts } = await query.graph({
    entity: "cart",
    filters: { id: cartId },
    fields: ["id", "metadata", "items.id", "items.variant_id"],
  })
  const cart = (carts as any[])?.[0]
  if (!cart) return res.status(404).json({ message: "Cart not found" })

  const existing = (cart.items as any[] | undefined)?.find(
    (it) => it.variant_id === feeVariant.id
  )

  try {
    if (enabled) {
      if (!existing) {
        await addToCartWorkflow(req.scope as any).run({
          input: {
            cart_id: cartId,
            items: [{ variant_id: feeVariant.id, quantity: 1 }],
          },
        })
      }
    } else if (existing) {
      await deleteLineItemsWorkflow(req.scope as any).run({
        input: { ids: [existing.id], cart_id: cartId } as any,
      })
    }

    const meta = (cart.metadata as any) || {}
    await cartModule.updateCarts([
      { id: cartId, metadata: { ...meta, cod_fee: enabled } },
    ])

    return res.json({ ok: true, cod_fee: enabled })
  } catch (e: any) {
    return res.status(500).json({
      message: e?.message || "Could not toggle COD fee",
    })
  }
}
