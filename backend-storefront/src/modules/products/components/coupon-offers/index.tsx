"use client"

import { useMemo, useState } from "react"
import { Tag, Check, X, Loader2, ChevronDown } from "lucide-react"

import { convertToLocale } from "@lib/util/money"
import type { StoreCoupon } from "@lib/data/promotions"

type Props = {
  coupons: StoreCoupon[]
  /** Code live on the cart right now. */
  appliedCode: string | null
  /** Code held for the cart that doesn't exist yet — applied on add to bag. */
  stagedCode: string | null
  pendingCode: string | null
  error: string
  onApply: (code: string) => void
  onRemove: () => void
}

/** How many offers show before "View all offers". */
const VISIBLE = 2

export const couponValueLabel = (c: StoreCoupon): string => {
  if (c.kind === "percentage") return `${c.value}% off`
  return `${convertToLocale({
    amount: c.value,
    currency_code: c.currency_code || "inr",
  })} off`
}

const targetLabel = (c: StoreCoupon): string | null =>
  c.target === "shipping_methods" ? "on shipping" : null

export default function CouponOffers({
  coupons,
  appliedCode,
  stagedCode,
  pendingCode,
  error,
  onApply,
  onRemove,
}: Props) {
  const [showAll, setShowAll] = useState(false)
  const [manualCode, setManualCode] = useState("")

  const activeCode = appliedCode || stagedCode
  const visible = showAll ? coupons : coupons.slice(0, VISIBLE)

  // A code the shopper typed that isn't in the advertised list still deserves
  // a confirmation row, so track whether the active one is a listed offer.
  const activeIsListed = useMemo(
    () => coupons.some((c) => c.code.toUpperCase() === activeCode?.toUpperCase()),
    [coupons, activeCode]
  )

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manualCode.trim().toUpperCase()
    if (!code || pendingCode) return
    onApply(code)
    setManualCode("")
  }

  return (
    <div className="rounded-lg border border-[var(--color-lavender)] bg-[var(--color-bg-secondary)] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Tag size={16} className="text-[var(--color-gold)] shrink-0" />
        <span className="text-xs font-semibold tracking-[0.06em] uppercase text-[var(--color-text-primary)]">
          Offers &amp; Coupons
        </span>
      </div>

      {coupons.length > 0 && (
        <div className="space-y-2">
          {visible.map((c) => {
            const isActive = c.code.toUpperCase() === activeCode?.toUpperCase()
            const isPending = c.code === pendingCode
            const target = targetLabel(c)

            return (
              <div
                key={c.id}
                className={`flex items-start gap-3 rounded-lg border border-dashed p-3 transition-colors ${
                  isActive
                    ? "border-[var(--color-gold)] bg-[var(--color-gold)]/[0.07]"
                    : "border-[var(--color-border)] bg-white"
                }`}
                data-testid="pdp-coupon-offer"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[0.78125rem] font-bold tracking-[0.12em] uppercase text-[var(--color-plum)]">
                      {c.code}
                    </span>
                    <span className="text-[0.75rem] font-semibold text-[var(--color-text-primary)]">
                      {couponValueLabel(c)}
                      {target ? ` ${target}` : ""}
                    </span>
                  </div>
                  {c.description && (
                    <p className="text-[0.6875rem] leading-snug text-[var(--color-text-muted)]">
                      {c.description}
                    </p>
                  )}
                  {c.first_order_only && (
                    <p className="text-[0.625rem] font-medium tracking-[0.05em] uppercase text-[var(--color-text-muted)]">
                      First order only
                    </p>
                  )}
                </div>

                {isActive ? (
                  <button
                    type="button"
                    onClick={onRemove}
                    className="shrink-0 inline-flex items-center gap-1 text-[0.71875rem] font-semibold uppercase tracking-[0.05em] text-[var(--color-plum)] hover:text-[var(--color-plum-deep)] transition-colors"
                    aria-label={`Remove ${c.code}`}
                  >
                    <Check size={13} className="text-green-600" />
                    Applied
                    <X size={13} className="opacity-60" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onApply(c.code)}
                    disabled={!!pendingCode}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-[0.71875rem] font-bold uppercase tracking-[0.05em] text-white bg-[var(--color-plum)] hover:bg-[var(--color-plum-deep)] disabled:opacity-50 transition-colors"
                    data-testid="pdp-coupon-apply"
                  >
                    {isPending ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      "Apply"
                    )}
                  </button>
                )}
              </div>
            )
          })}

          {coupons.length > VISIBLE && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-[var(--color-plum)] hover:text-[var(--color-plum-deep)] transition-colors"
            >
              View all {coupons.length} offers
              <ChevronDown size={13} />
            </button>
          )}
        </div>
      )}

      {/* Manual entry — always available, codes needn't be advertised. */}
      <form onSubmit={submitManual} className="flex gap-2">
        <input
          type="text"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.toUpperCase())}
          placeholder="Enter coupon code"
          className="flex-1 h-10 px-3 rounded-lg text-[0.8125rem] uppercase tracking-wider outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
          data-testid="pdp-coupon-input"
        />
        <button
          type="submit"
          disabled={!manualCode.trim() || !!pendingCode}
          className="px-5 h-10 rounded-lg text-xs font-semibold tracking-[0.05em] uppercase text-white bg-[var(--color-plum)] hover:bg-[var(--color-plum-deep)] transition-colors disabled:opacity-50"
        >
          Apply
        </button>
      </form>

      {/* A typed-in code that isn't one of the listed offers still needs a
          visible applied/remove state. */}
      {activeCode && !activeIsListed && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-[var(--color-gold)] px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--color-plum)]">
            <Check size={13} className="text-green-600" />
            <span className="tracking-[0.1em] uppercase">{activeCode}</span>
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${activeCode}`}
            className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X size={13} className="text-[var(--color-text-secondary)]" />
          </button>
        </div>
      )}

      {stagedCode && !appliedCode && (
        <p className="text-[0.6875rem] text-[var(--color-text-muted)]">
          Saved — applied automatically when you add this to your bag.
        </p>
      )}

      {error && (
        <p className="text-[0.75rem] text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
