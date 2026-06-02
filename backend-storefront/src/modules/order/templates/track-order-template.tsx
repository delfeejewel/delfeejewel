"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { Package, Mail, Hash, Search, Truck, ExternalLink } from "lucide-react"

import { lookupOrder } from "@lib/data/orders"
import { convertToLocale } from "@lib/util/money"
import OrderTimeline from "@modules/order/components/order-timeline"

type FoundOrder = {
  id: string
  display_id: number
  email: string
  created_at: string
  currency_code: string
  status: string
  total: number
  subtotal: number
  shipping_total?: number
  discount_total?: number
  metadata?: Record<string, any> | null
  items?: Array<{
    title: string
    quantity: number
    unit_price: number
    thumbnail?: string | null
    product_handle?: string | null
  }>
  shipping_address?: {
    city?: string | null
    province?: string | null
    postal_code?: string | null
    country_code?: string | null
  } | null
}

const FALLBACK = "/images/fallback-no-image.png"

export default function TrackOrderTemplate() {
  const params = useSearchParams()
  const [orderNum, setOrderNum] = useState("")
  const [email, setEmail] = useState("")

  // Prefill order number from ?order= (used by the order-confirmation email)
  useEffect(() => {
    const fromUrl = params.get("order")
    if (fromUrl) setOrderNum(fromUrl)
  }, [params])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [order, setOrder] = useState<FoundOrder | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setOrder(null)
    const idNum = Number(orderNum.replace(/^#/, "").trim())
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return setError("Enter a valid order number (e.g. 1234).")
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("Enter a valid email address.")
    }
    setSubmitting(true)
    const res = await lookupOrder(idNum, email.trim())
    setSubmitting(false)
    if (res.order) setOrder(res.order)
    else setError(res.error || "Lookup failed.")
  }

  const meta = (order?.metadata || {}) as any
  const awb = meta.awb as string | undefined
  const courier = meta.shiprocket_courier as string | undefined

  return (
    <div className="bg-[var(--color-bg-primary)] min-h-screen">
      <div className="page-container py-10 small:py-16">
        <header className="text-center mb-10">
          <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[var(--color-gold)]">
            Order Tracking
          </span>
          <h1 className="font-wittgenstein text-[32px] tablet:text-[42px] font-bold text-[var(--color-plum)] mt-2">
            Where&apos;s My Order?
          </h1>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-2 max-w-lg mx-auto">
            Enter your order number and the email you used at checkout to see
            the latest delivery status.
          </p>
        </header>

        <div className="grid grid-cols-1 medium:grid-cols-[380px_1fr] gap-8 medium:gap-12 max-w-5xl mx-auto">
          {/* ── Lookup form ──────────────────────── */}
          <form
            onSubmit={submit}
            className="bg-white rounded-2xl border border-[var(--color-lavender)] p-6 small:p-7 flex flex-col gap-4 h-fit"
          >
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] flex items-center gap-1.5 mb-1.5">
                <Hash size={11} /> Order number
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={orderNum}
                onChange={(e) => {
                  setOrderNum(e.target.value)
                  setError("")
                }}
                placeholder="1234"
                className="w-full px-3.5 py-2.5 rounded-lg text-[14px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] flex items-center gap-1.5 mb-1.5">
                <Mail size={11} /> Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError("")
                }}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg text-[14px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
              />
            </div>
            {error && <p className="text-[12.5px] text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-1 inline-flex items-center justify-center gap-2 py-3 rounded-full bg-[var(--color-plum)] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[var(--color-plum-deep)] disabled:opacity-50 transition-all"
            >
              <Search size={14} />
              {submitting ? "Searching..." : "Track Order"}
            </button>

            <p className="text-[11.5px] text-[var(--color-text-muted)] mt-1">
              Tip: your order number is in the confirmation email — it looks
              like #1234.
            </p>
          </form>

          {/* ── Result panel ─────────────────────── */}
          <div>
            {!order ? (
              <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-[var(--color-lavender)] h-full min-h-[280px] p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-[var(--color-lavender)] flex items-center justify-center mb-3">
                  <Package
                    size={24}
                    className="text-[var(--color-plum)]"
                    strokeWidth={1.6}
                  />
                </div>
                <p className="font-wittgenstein text-[18px] font-semibold text-[var(--color-plum)]">
                  Your tracking will appear here
                </p>
                <p className="text-[13.5px] text-[var(--color-text-muted)] max-w-sm mt-1">
                  Enter your order details on the left and we&apos;ll fetch the
                  live status from our courier partner.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[var(--color-lavender)] p-6 small:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-[var(--color-border)]">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-plum)]">
                      Order #{order.display_id}
                    </span>
                    <p className="text-[12.5px] text-[var(--color-text-muted)]">
                      Placed on{" "}
                      {new Date(order.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="font-wittgenstein text-[20px] font-bold text-[var(--color-plum)]">
                    {convertToLocale({
                      amount: order.total,
                      currency_code: order.currency_code,
                    })}
                  </span>
                </div>

                <div className="my-6">
                  <OrderTimeline
                    createdAt={order.created_at}
                    history={meta.shiprocket_history || []}
                    isCanceled={order.status === "canceled"}
                    rtoProcessedAt={meta.rto_processed_at || null}
                    rtoRefundAmount={Number(meta.rto_refund_amount) || null}
                    currencyCode={order.currency_code}
                  />
                </div>

                {(awb || courier) && (
                  <div className="mt-2 mb-6 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] flex items-center gap-3">
                    <Truck
                      size={18}
                      className="text-[var(--color-plum)] shrink-0"
                      strokeWidth={1.6}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-semibold">
                        Tracking
                      </p>
                      <p className="text-[13.5px] text-[var(--color-text-primary)] font-medium">
                        {awb && (
                          <span className="font-mono tracking-wider">
                            {awb}
                          </span>
                        )}
                        {courier && (
                          <span className="text-[var(--color-text-muted)]">
                            {awb ? " · " : ""}
                            {courier}
                          </span>
                        )}
                      </p>
                    </div>
                    {awb && (
                      <a
                        href={`https://shiprocket.co/tracking/${encodeURIComponent(
                          awb
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-plum)] hover:text-[var(--color-plum-deep)]"
                      >
                        Open
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                )}

                {/* Items preview */}
                <div className="pt-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-semibold mb-2.5">
                    Items
                  </p>
                  <ul className="flex flex-col gap-3">
                    {(order.items || []).map((it, i) => {
                      const qty = it.quantity || 1
                      return (
                        <li key={i} className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] shrink-0">
                            <Image
                              src={it.thumbnail || FALLBACK}
                              alt={it.title}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13.5px] font-semibold text-[var(--color-text-primary)] capitalize truncate">
                              {it.title}
                            </p>
                            <p className="text-[12px] text-[var(--color-text-muted)]">
                              Qty {qty}
                            </p>
                          </div>
                          <span className="text-[13px] font-semibold text-[var(--color-plum)] tabular-nums">
                            {convertToLocale({
                              amount: (it.unit_price || 0) * qty,
                              currency_code: order.currency_code,
                            })}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
