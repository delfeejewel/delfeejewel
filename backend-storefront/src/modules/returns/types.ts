export type ReturnReason =
  | "wrong_size"
  | "different_from_description"
  | "damaged"
  | "quality"
  | "changed_mind"
  | "other"

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  wrong_size: "Wrong size",
  different_from_description: "Different from description",
  damaged: "Arrived damaged / defective",
  quality: "Quality wasn't as expected",
  changed_mind: "Changed my mind",
  other: "Other",
}

export type ReturnStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "received"
  | "completed"
  | "canceled"

export type ReturnRequestType = "refund" | "exchange"

export type ReturnRequest = {
  id: string
  order_id: string
  customer_id: string
  type: ReturnRequestType
  status: ReturnStatus
  reason: string
  message: string | null
  rejected_reason: string | null
  refund_amount: number | null
  replacement_order_id: string | null
  currency_code: string
  created_at: string
  approved_at: string | null
  rejected_at: string | null
  received_at: string | null
  processed_at: string | null
  items?: ReturnRequestItem[]
}

export type ReturnRequestItem = {
  id: string
  line_item_id: string
  variant_id: string | null
  title: string
  thumbnail: string | null
  quantity: number
  unit_price: number
  reason: string | null
  exchange_variant_id: string | null
}

export type ExchangeVariantOption = {
  id: string
  title: string
  price: number
  currency_code: string
  in_stock: boolean
}
