"use server"

import { sdk } from "@lib/config"
import { revalidateTag } from "next/cache"
import { getAuthHeaders, getCacheOptions, getCacheTag } from "./cookies"
import type {
  PendingReview,
  SubmittedReview,
  ProductReview,
  ReviewSummary,
} from "@modules/reviews/types"

const hasAuth = (
  headers: { authorization: string } | {}
): headers is { authorization: string } => "authorization" in headers

/** The signed-in customer's pending + already-submitted reviews. */
export const getMyReviews = async (): Promise<{
  pending: PendingReview[]
  submitted: SubmittedReview[]
}> => {
  const headers = await getAuthHeaders()
  if (!hasAuth(headers)) return { pending: [], submitted: [] }

  const next = { ...(await getCacheOptions("reviews")) }

  return sdk.client
    .fetch<{ pending: PendingReview[]; submitted: SubmittedReview[] }>(
      `/store/customers/me/reviews`,
      { method: "GET", headers, next, cache: "force-cache" }
    )
    .then((d) => ({ pending: d.pending ?? [], submitted: d.submitted ?? [] }))
    .catch(() => ({ pending: [], submitted: [] }))
}

export const submitReview = async (input: {
  product_id: string
  order_id: string
  rating: number
  content: string
}): Promise<{ success: boolean; error: string | null }> => {
  const headers = await getAuthHeaders()
  if (!hasAuth(headers)) {
    return { success: false, error: "You must be signed in to review." }
  }

  try {
    await sdk.client.fetch(`/store/customers/me/reviews`, {
      method: "POST",
      headers,
      body: input,
    })
    const tag = await getCacheTag("reviews")
    if (tag) revalidateTag(tag)
    return { success: true, error: null }
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || "Could not submit your review. Please try again.",
    }
  }
}

/** Public — approved reviews + rating summary for a product (PDP). */
export const getProductReviews = async (
  productId: string
): Promise<{ reviews: ProductReview[]; summary: ReviewSummary }> => {
  const next = { ...(await getCacheOptions("reviews")) }

  return sdk.client
    .fetch<{ reviews: ProductReview[]; summary: ReviewSummary }>(
      `/store/reviews`,
      {
        method: "GET",
        query: { product_id: productId },
        next,
        cache: "force-cache",
      }
    )
    .then((d) => d)
    .catch(() => ({
      reviews: [],
      summary: { count: 0, average: 0, breakdown: {} },
    }))
}
