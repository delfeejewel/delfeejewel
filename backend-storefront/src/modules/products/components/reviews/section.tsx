import { getProductReviews } from "@lib/data/reviews"
import ProductReviews from "./index"

/**
 * Server wrapper — fetches a product's reviews and renders the client
 * reviews display.
 */
export default async function ProductReviewsSection({
  productId,
}: {
  productId: string
}) {
  const { reviews, summary } = await getProductReviews(productId)
  return <ProductReviews reviews={reviews} summary={summary} />
}
