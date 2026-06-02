import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  addToCartWorkflow,
  deleteLineItemsWorkflow,
} from "@medusajs/medusa/core-flows"

const GIFT_WRAP_HANDLE = "gift-wrap"
const GIFT_WRAP_SKU = "GIFT-WRAP-INR-50"

/**
 * POST /store/carts/:id/gift-wrap
 * Body: { enabled: boolean }
 *
 * Toggles the gift-wrap add-on on a cart. When enabled, adds a single line
 * item for the gift-wrap variant (₹50) and sets cart.metadata.gift_wrap = true.
 * When disabled, removes the line item and clears the metadata flag.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id
  const { enabled } = (req.body || {}) as { enabled?: boolean }

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ message: "Body must include enabled: boolean" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const cartModule: any = req.scope.resolve(Modules.CART)

  // Resolve the gift-wrap variant. Cached lookups would be a nice future
  // optimization — for now this is two queries on every toggle.
  const { data: products } = await query.graph({
    entity: "product",
    filters: { handle: GIFT_WRAP_HANDLE },
    fields: ["id", "variants.id", "variants.sku"],
  })
  const gwProduct = (products as any[])?.[0]
  const gwVariant = gwProduct?.variants?.find((v: any) => v.sku === GIFT_WRAP_SKU)
    || gwProduct?.variants?.[0]
  if (!gwVariant) {
    return res.status(500).json({
      message:
        "Gift wrap product not seeded. Run: npx medusa exec ./src/scripts/seed-gift-wrap-product.ts",
    })
  }

  // Fetch the cart to see if it already has the line item
  const { data: carts } = await query.graph({
    entity: "cart",
    filters: { id: cartId },
    fields: [
      "id",
      "metadata",
      "items.id",
      "items.variant_id",
    ],
  })
  const cart = (carts as any[])?.[0]
  if (!cart) return res.status(404).json({ message: "Cart not found" })

  const existing = (cart.items as any[] | undefined)?.find(
    (it) => it.variant_id === gwVariant.id
  )

  try {
    if (enabled) {
      if (!existing) {
        await addToCartWorkflow(req.scope as any).run({
          input: {
            cart_id: cartId,
            items: [{ variant_id: gwVariant.id, quantity: 1 }],
          },
        })
      }
    } else if (existing) {
      await deleteLineItemsWorkflow(req.scope as any).run({
        input: { ids: [existing.id], cart_id: cartId } as any,
      })
    }

    // Sync the flag on cart metadata so the order subscriber / ops widget
    // can read it without joining on line items.
    const meta = (cart.metadata as any) || {}
    await cartModule.updateCarts([
      {
        id: cartId,
        metadata: { ...meta, gift_wrap: enabled },
      },
    ])

    return res.json({ ok: true, gift_wrap: enabled })
  } catch (e: any) {
    return res.status(500).json({
      message: e?.message || "Could not toggle gift wrap",
    })
  }
}
