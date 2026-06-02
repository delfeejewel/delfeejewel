import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { WISHLIST_MODULE } from "../modules/wishlist"
import type WishlistModuleService from "../modules/wishlist/service"

type DeletedPayload = { id?: string; ids?: string[] }

/**
 * Removes a product from every customer's wishlist when it is deleted.
 * wishlist_item has no cross-module foreign key (Medusa modules are isolated),
 * so this subscriber keeps the table free of orphaned rows.
 */
export default async function wishlistProductDeletedHandler({
  event,
  container,
}: SubscriberArgs<DeletedPayload | DeletedPayload[]>) {
  const data = event.data
  const productIds = Array.isArray(data)
    ? data.flatMap((d) => d.ids ?? (d.id ? [d.id] : []))
    : data.ids ?? (data.id ? [data.id] : [])

  if (!productIds.length) return

  const wishlistService: WishlistModuleService =
    container.resolve(WISHLIST_MODULE)

  const items = await wishlistService.listWishlistItems({
    product_id: productIds,
  })
  if (items.length) {
    await wishlistService.deleteWishlistItems(items.map((i) => i.id))
  }
}

export const config: SubscriberConfig = {
  event: "product.deleted",
}
