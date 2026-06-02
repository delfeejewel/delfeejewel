import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { WISHLIST_MODULE } from "../modules/wishlist"
import type WishlistModuleService from "../modules/wishlist/service"

type DeletedPayload = { id?: string; ids?: string[] }

/**
 * Removes a customer's saved products when their account is deleted.
 * wishlist_item has no cross-module foreign key (Medusa modules are isolated),
 * so this subscriber keeps the table free of orphaned rows.
 */
export default async function wishlistCustomerDeletedHandler({
  event,
  container,
}: SubscriberArgs<DeletedPayload | DeletedPayload[]>) {
  const data = event.data
  const customerIds = Array.isArray(data)
    ? data.flatMap((d) => d.ids ?? (d.id ? [d.id] : []))
    : data.ids ?? (data.id ? [data.id] : [])

  if (!customerIds.length) return

  const wishlistService: WishlistModuleService =
    container.resolve(WISHLIST_MODULE)

  const items = await wishlistService.listWishlistItems({
    customer_id: customerIds,
  })
  if (items.length) {
    await wishlistService.deleteWishlistItems(items.map((i) => i.id))
  }
}

export const config: SubscriberConfig = {
  event: "customer.deleted",
}
