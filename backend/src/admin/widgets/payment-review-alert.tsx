import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect, useState } from "react"

/**
 * Alert banner above the orders list: surfaces captured payments that never
 * became orders (flagged by the Razorpay reconciler). Hidden when there are
 * none. Links to the "Payments to Review" page.
 */
const PaymentReviewAlert = () => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    fetch("/admin/flagged-carts", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((b) => setCount(b?.count || 0))
      .catch(() => {})
  }, [])

  if (count <= 0) return null

  return (
    <div
      style={{
        margin: "0 0 12px",
        padding: "12px 16px",
        borderRadius: 12,
        background: "var(--tag-red-bg)",
        border: "1px solid var(--tag-red-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13.5, color: "var(--tag-red-text)", fontWeight: 600 }}>
        ⚠️ {count} payment{count > 1 ? "s" : ""} captured with no order created.
      </span>
      <a
        href="/app/payment-review"
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: "6px 14px",
          borderRadius: 999,
          background: "var(--tag-red-text)",
          color: "var(--bg-base)",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Review →
      </a>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "order.list.before",
})

export default PaymentReviewAlert
