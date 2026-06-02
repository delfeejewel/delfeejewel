import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { WISHLIST_MODULE } from "../../../../../../modules/wishlist"
import type WishlistModuleService from "../../../../../../modules/wishlist/service"

/**
 * DELETE /store/customers/me/wishlist/:productId
 * Removes a product from the authenticated customer's wishlist.
 */
export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  const { productId } = req.params
  const wishlistService: WishlistModuleService =
    req.scope.resolve(WISHLIST_MODULE)

  const existing = await wishlistService.listWishlistItems({
    customer_id: customerId,
    product_id: productId,
  })
  if (existing.length) {
    await wishlistService.deleteWishlistItems(existing.map((e) => e.id))
  }

  return res.json({ success: true, product_id: productId })
}
