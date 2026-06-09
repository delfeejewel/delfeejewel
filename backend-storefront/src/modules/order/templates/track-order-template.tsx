"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Package, Mail, Hash, Search, Truck, ExternalLink } from "lucide-react"

import { lookupOrder, lookupOrderByToken } from "@lib/data/orders"
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

/* Floating jewellery decor + soft glows — mirrors the footer's ambient layer,
   tuned for a light background. Purely decorative, behind the content. */
function TrackDecor() {
  const gold = "var(--color-gold)"
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none hidden small:block"
      aria-hidden="true"
    >
      {/* Soft gradient glows */}
      <div
        className="absolute -top-28 -left-24 w-[30rem] h-[30rem] rounded-full bg-[var(--color-lavender)]/50 blur-3xl"
        style={{ animation: "deco-glow 26s ease-in-out infinite" }}
      />
      <div
        className="absolute top-[28%] -right-28 w-[26rem] h-[26rem] rounded-full bg-[var(--color-gold)]/[0.07] blur-3xl"
        style={{ animation: "deco-glow 32s ease-in-out -8s infinite reverse" }}
      />
      <div
        className="absolute -bottom-32 left-[18%] w-[28rem] h-[28rem] rounded-full bg-[var(--color-plum)]/[0.04] blur-[120px]"
        style={{ animation: "deco-glow 30s ease-in-out -12s infinite" }}
      />

      {/* Ring — top right */}
      <svg
        className="absolute top-24 right-[7%] w-24 h-24 opacity-[0.08]"
        style={{ animation: "deco-drift 28s ease-in-out infinite" }}
        viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={0.5}
      >
        <circle cx="12" cy="14" r="8" />
        <ellipse cx="12" cy="14" rx="4" ry="8" />
        <path d="M8 6.5c1-1.5 2.5-2.5 4-2.5s3 1 4 2.5" />
      </svg>

      {/* Gem — bottom left */}
      <svg
        className="absolute bottom-24 left-[6%] w-20 h-20 opacity-[0.09]"
        style={{ animation: "deco-drift-alt 31s ease-in-out -6s infinite" }}
        viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={0.6}
      >
        <polygon points="12,2 22,8.5 17,22 7,22 2,8.5" />
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="8.5" x2="22" y2="8.5" />
      </svg>

      {/* Sparkles */}
      <svg
        className="absolute top-[35%] left-[4%] w-12 h-12 opacity-[0.12]"
        style={{ animation: "deco-twinkle 7s ease-in-out infinite" }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
      <svg
        className="absolute top-[16%] right-[26%] w-7 h-7 opacity-[0.1]"
        style={{ animation: "deco-twinkle 6s ease-in-out -2s infinite" }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
      <svg
        className="absolute bottom-[26%] right-[11%] w-9 h-9 opacity-[0.1]"
        style={{ animation: "deco-twinkle 8s ease-in-out -3s infinite" }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
    </div>
  )
}

export default function TrackOrderTemplate() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [orderNum, setOrderNum] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [error, setError] = useState("")
  const [order, setOrder] = useState<FoundOrder | null>(null)

  // Prefill order number from ?order= (used by the order-confirmation email).
  // When the email link also carries a signed ?t= token, open the order
  // directly — no need to re-enter the email.
  useEffect(() => {
    const fromUrl = params.get("order")
    if (fromUrl) setOrderNum(fromUrl)

    const token = params.get("t")
    if (!token) return

    let active = true
    setTokenLoading(true)
    setError("")
    lookupOrderByToken(token).then((res) => {
      if (!active) return
      setTokenLoading(false)
      if (res.order) {
        setOrder(res.order)
        // Reflect the email the order was placed with so the form is complete.
        if (res.order.email) setEmail(res.order.email)
      } else {
        setError(res.error || "This tracking link is invalid or has expired.")
      }
    })
    return () => {
      active = false
    }
  }, [params])

  const reset = () => {
    setOrder(null)
    setError("")
    setOrderNum("")
    setEmail("")
    // Drop ?order= / ?t= so a refresh doesn't reopen the previous order.
    router.replace(pathname)
  }

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
  const codUpfront = Number(meta.cod_upfront_amount) || 0
  const codDue = Math.max(0, (Number(order?.total) || 0) - codUpfront)
  const awb = meta.awb as string | undefined
  const courier = meta.shiprocket_courier as string | undefined

  return (
    <div className="relative bg-[var(--color-bg-primary)] overflow-hidden">
      <TrackDecor />
      <div className="page-container relative z-10 py-10 small:py-14">
        <header className="text-center mb-10">
          <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[var(--color-gold)]">
            Order Tracking
          </span>
          <h1 className="font-wittgenstein text-[32px] tablet:text-[42px] font-bold text-[var(--color-plum)] mt-2">
            Where&apos;s My Order?
          </h1>
          <div className="flex items-center justify-center gap-2.5 mt-3.5">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-[var(--color-gold)]/50" />
            <svg className="w-3 h-3 text-[var(--color-gold)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
            </svg>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-[var(--color-gold)]/50" />
          </div>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-3.5 max-w-lg mx-auto">
            Enter your order number and the email you used at checkout to see
            the latest delivery status.
          </p>
        </header>

        <div className="grid grid-cols-1 medium:grid-cols-[380px_1fr] gap-8 max-w-5xl mx-auto items-stretch">
          {/* ── Lookup form ──────────────────────── */}
          <form
            onSubmit={submit}
            className="bg-white rounded-3xl border border-[var(--color-lavender)] shadow-[0_10px_40px_-12px_rgba(93,46,70,0.12)] p-6 small:p-7 flex flex-col gap-4"
          >
            <div className="flex items-center gap-3 pb-1">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-lavender)]/60 text-[var(--color-plum)]">
                <Search size={18} />
              </span>
              <div>
                <h2 className="font-wittgenstein text-[18px] font-bold text-[var(--color-plum)] leading-tight">
                  Find your order
                </h2>
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  Takes just a few seconds
                </p>
              </div>
            </div>

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
                className="w-full px-3.5 py-2.5 rounded-lg text-[14px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-plum)] focus:ring-2 focus:ring-[var(--color-plum)]/15 transition-all"
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
                className="w-full px-3.5 py-2.5 rounded-lg text-[14px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-plum)] focus:ring-2 focus:ring-[var(--color-plum)]/15 transition-all"
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

            {order && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 py-2.5 rounded-full border border-[var(--color-border)] text-[var(--color-plum)] text-[12px] font-bold uppercase tracking-wider hover:bg-[var(--color-lavender)]/40 transition-all"
              >
                Find another order
              </button>
            )}

            <p className="text-[11.5px] text-[var(--color-text-muted)]">
              Tip: your order number is in the confirmation email — it looks
              like #1234.
            </p>

            <div className="mt-auto pt-4 border-t border-[var(--color-border)]">
              <p className="text-[12px] text-[var(--color-text-muted)]">
                Can&apos;t find your order?{" "}
                <a
                  href="/contact"
                  className="font-semibold text-[var(--color-plum)] hover:underline"
                >
                  Contact us
                </a>
              </p>
            </div>
          </form>

          {/* ── Result panel ─────────────────────── */}
          <div>
            {!order ? (
              <div className="flex flex-col items-center justify-center bg-white rounded-3xl border border-[var(--color-lavender)] shadow-[0_10px_40px_-12px_rgba(93,46,70,0.12)] h-full min-h-[280px] p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-[var(--color-lavender)] flex items-center justify-center mb-3">
                  <Package
                    size={24}
                    className="text-[var(--color-plum)]"
                    strokeWidth={1.6}
                  />
                </div>
                <p className="font-wittgenstein text-[18px] font-semibold text-[var(--color-plum)]">
                  {tokenLoading
                    ? "Fetching your order…"
                    : "Your tracking will appear here"}
                </p>
                <p className="text-[13.5px] text-[var(--color-text-muted)] max-w-sm mt-1">
                  {tokenLoading
                    ? "Opening the order from your email link."
                    : "Enter your order details on the left and we'll fetch the live status from our courier partner."}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-[var(--color-lavender)] shadow-[0_10px_40px_-12px_rgba(93,46,70,0.12)] p-6 small:p-7 h-full flex flex-col">
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
                  <span className="inline-flex items-center rounded-full bg-[var(--color-lavender)]/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-plum)] capitalize">
                    {order.status === "canceled" ? "Cancelled" : "Active"}
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

                {/* Price breakdown — pinned to the bottom so the card stays
                    vertically balanced with the lookup form. */}
                <div className="mt-auto pt-5">
                  <div className="border-t border-[var(--color-border)] pt-4 flex flex-col gap-1.5 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-secondary)]">Subtotal</span>
                      <span className="tabular-nums text-[var(--color-text-primary)]">
                        {convertToLocale({
                          amount: Number(order.subtotal) || 0,
                          currency_code: order.currency_code,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-secondary)]">Shipping</span>
                      <span className="tabular-nums text-[var(--color-text-primary)]">
                        {Number(order.shipping_total) > 0
                          ? convertToLocale({
                              amount: Number(order.shipping_total),
                              currency_code: order.currency_code,
                            })
                          : "Free"}
                      </span>
                    </div>
                    {Number(order.discount_total) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Discount</span>
                        <span className="tabular-nums text-green-600">
                          −
                          {convertToLocale({
                            amount: Number(order.discount_total),
                            currency_code: order.currency_code,
                          })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2.5 mt-1 border-t border-[var(--color-border)]">
                      <span className="font-semibold text-[var(--color-plum)]">Total</span>
                      <span className="font-semibold tabular-nums text-[var(--color-plum)]">
                        {convertToLocale({
                          amount: Number(order.total) || 0,
                          currency_code: order.currency_code,
                        })}
                      </span>
                    </div>

                    {/* COD advance token: paid now vs balance due on delivery */}
                    {codUpfront > 0 && (
                      <div className="mt-2.5 pt-3 border-t border-dashed border-[var(--color-border)] flex flex-col gap-1.5">
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">
                            Advance paid
                          </span>
                          <span className="tabular-nums text-[var(--color-text-primary)]">
                            {convertToLocale({
                              amount: codUpfront,
                              currency_code: order.currency_code,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">
                            Due on delivery
                          </span>
                          <span className="font-semibold tabular-nums text-[var(--color-plum)]">
                            {convertToLocale({
                              amount: codDue,
                              currency_code: order.currency_code,
                            })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
