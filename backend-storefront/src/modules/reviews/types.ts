export type PendingReview = {
  product_id: string
  title: string
  handle: string | null
  thumbnail: string | null
  order_id: string
  order_display_id: number
}

export type SubmittedReview = {
  id: string
  product_id: string
  product_title: string
  product_handle: string | null
  product_thumbnail: string | null
  rating: number
  content: string
  status: string
  created_at: string
}

export type ProductReview = {
  id: string
  customer_name: string
  rating: number
  content: string
  created_at: string
}

export type ReviewSummary = {
  count: number
  average: number
  breakdown: Record<string, number>
}
