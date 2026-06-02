import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { REVIEW_MODULE } from "../../../modules/review"
import type ReviewModuleService from "../../../modules/review/service"

/**
 * GET /store/reviews?product_id=<id>
 * Public — approved reviews for a product plus the rating summary.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productId = req.query.product_id as string | undefined
  if (!productId) {
    return res.status(400).json({ message: "product_id is required" })
  }

  const reviewService: ReviewModuleService = req.scope.resolve(REVIEW_MODULE)

  const reviews = await reviewService.listProductReviews(
    { product_id: productId, status: "approved" },
    { order: { created_at: "DESC" } }
  )

  const count = reviews.length
  const average = count
    ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count
    : 0
  const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of reviews) {
    if (r.rating >= 1 && r.rating <= 5) breakdown[r.rating]++
  }

  return res.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      customer_name: r.customer_name,
      rating: r.rating,
      content: r.content,
      created_at: r.created_at,
    })),
    summary: {
      count,
      average: Math.round(average * 10) / 10,
      breakdown,
    },
  })
}
