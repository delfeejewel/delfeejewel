import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { REVIEW_MODULE } from "../../../../../modules/review"
import type ReviewModuleService from "../../../../../modules/review/service"

const delayMs = () => (Number(process.env.REVIEW_DELAY_HOURS) || 4) * 3600_000

/**
 * GET /store/customers/me/reviews
 * Returns products the customer can still review (from delivered orders, after
 * the delay) plus the reviews they've already submitted.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Reviews joined with their product in one query, via the read-only
  // product_review -> product module link.
  const { data: reviewRows } = await query.graph({
    entity: "product_review",
    filters: { customer_id: customerId },
    fields: [
      "id",
      "product_id",
      "order_id",
      "rating",
      "content",
      "status",
      "created_at",
      "product.title",
      "product.handle",
      "product.thumbnail",
    ],
  })
  const reviews = (reviewRows as any[]) || []
  const reviewedProductIds = new Set(reviews.map((r) => r.product_id))

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { customer_id: customerId },
    fields: [
      "id",
      "display_id",
      "metadata",
      "items.product_id",
      "items.product_title",
      "items.title",
      "items.product_handle",
      "items.thumbnail",
    ],
  })

  const cutoff = delayMs()
  const now = Date.now()
  const pending = new Map<string, any>()

  for (const order of orders || []) {
    const deliveredAt = (order.metadata as any)?.delivered_at
    if (!deliveredAt) continue
    if (now - new Date(deliveredAt).getTime() < cutoff) continue

    for (const item of (order.items as any[]) || []) {
      const pid = item?.product_id
      if (!pid || reviewedProductIds.has(pid) || pending.has(pid)) continue
      pending.set(pid, {
        product_id: pid,
        title: item.product_title || item.title || "Product",
        handle: item.product_handle || null,
        thumbnail: item.thumbnail || null,
        order_id: order.id,
        order_display_id: order.display_id,
      })
    }
  }

  // Submitted reviews — product data already joined via the module link.
  const submitted = reviews
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map((r) => ({
      id: r.id,
      product_id: r.product_id,
      product_title: r.product?.title || "Product",
      product_handle: r.product?.handle || null,
      product_thumbnail: r.product?.thumbnail || null,
      rating: r.rating,
      content: r.content,
      status: r.status,
      created_at: r.created_at,
    }))

  return res.json({
    pending: [...pending.values()],
    submitted,
  })
}

/**
 * POST /store/customers/me/reviews  { product_id, order_id, rating, content }
 * Submits a verified-purchase review after re-checking eligibility.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  const { product_id, order_id, rating, content } = (req.body ?? {}) as Record<
    string,
    any
  >
  const r = Number(rating)

  if (!product_id || !order_id) {
    return res
      .status(400)
      .json({ message: "product_id and order_id are required" })
  }
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ message: "rating must be an integer 1-5" })
  }
  if (!content || !String(content).trim()) {
    return res.status(400).json({ message: "review text is required" })
  }

  const reviewService: ReviewModuleService = req.scope.resolve(REVIEW_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const existing = await reviewService.listProductReviews({
    customer_id: customerId,
    product_id,
  })
  if (existing.length) {
    return res
      .status(409)
      .json({ message: "You have already reviewed this product" })
  }

  // Re-validate eligibility against the order
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: order_id },
    fields: ["id", "customer_id", "metadata", "items.product_id"],
  })
  const order = orders?.[0]
  if (!order || order.customer_id !== customerId) {
    return res.status(403).json({ message: "Order not found" })
  }
  const deliveredAt = (order.metadata as any)?.delivered_at
  if (!deliveredAt || Date.now() - new Date(deliveredAt).getTime() < delayMs()) {
    return res
      .status(403)
      .json({ message: "This order is not yet eligible for a review" })
  }
  if (
    !((order.items as any[]) || []).some((i) => i?.product_id === product_id)
  ) {
    return res.status(403).json({ message: "Product is not in this order" })
  }

  // Reviewer display name (denormalised onto the review)
  let customerName = "Customer"
  try {
    const customerModule: any = req.scope.resolve(Modules.CUSTOMER)
    const customer = await customerModule.retrieveCustomer(customerId)
    const fn = (customer?.first_name || "").trim()
    const ln = (customer?.last_name || "").trim()
    if (fn) customerName = ln ? `${fn} ${ln[0]}.` : fn
  } catch {
    /* fall back to "Customer" */
  }

  const review = await reviewService.createProductReviews({
    customer_id: customerId,
    customer_name: customerName,
    product_id,
    order_id,
    rating: r,
    content: String(content).trim().slice(0, 4000),
    status: "approved",
  })

  return res.status(201).json({ review })
}
