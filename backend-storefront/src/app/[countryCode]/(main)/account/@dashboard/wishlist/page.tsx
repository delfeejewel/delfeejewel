import { Metadata } from "next"

import WishlistView from "@modules/account/components/wishlist-view"
import { getWishlist } from "@lib/data/wishlist"

export const metadata: Metadata = {
  title: "My Wishlist",
  description: "The pieces you've saved to your collection.",
}

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const products = await getWishlist(countryCode)

  return <WishlistView products={products} countryCode={countryCode} />
}
