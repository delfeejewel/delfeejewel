import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"
import type WishlistModuleService from "../../../../../modules/wishlist/service"

/**
 * GET /store/customers/me/wishlist
 * Returns the authenticated customer's saved product references (newest first).
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  const wishlistService: WishlistModuleService =
    req.scope.resolve(WISHLIST_MODULE)

  const wishlist = await wishlistService.listWishlistItems(
    { customer_id: customerId },
    { order: { created_at: "DESC" } }
  )

  return res.json({ wishlist })
}

/**
 * POST /store/customers/me/wishlist  { product_id }
 * Adds a product to the customer's wishlist. Idempotent — adding a product
 * that is already saved returns the existing entry.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  const { product_id } = (req.body ?? {}) as { product_id?: string }
  if (!product_id) {
    return res.status(400).json({ message: "product_id is required" })
  }

  // Only real products can be wishlisted — otherwise arbitrary ids pile up
  // as junk rows and break the wishlist page's product hydration.
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { id: product_id },
  })
  if (!product) {
    return res.status(404).json({ message: "Product not found" })
  }

  const wishlistService: WishlistModuleService =
    req.scope.resolve(WISHLIST_MODULE)

  const existing = await wishlistService.listWishlistItems({
    customer_id: customerId,
    product_id,
  })
  if (existing.length) {
    return res.json({ wishlist_item: existing[0] })
  }

  const wishlist_item = await wishlistService.createWishlistItems({
    customer_id: customerId,
    product_id,
  })

  return res.status(201).json({ wishlist_item })
}
