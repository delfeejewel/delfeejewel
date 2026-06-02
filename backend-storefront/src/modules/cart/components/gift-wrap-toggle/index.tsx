"use client"

import { useState } from "react"
import { Gift, Check } from "lucide-react"

import { toggleGiftWrap } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"

const GIFT_WRAP_PRICE = 50

export default function GiftWrapToggle({
  initial,
  currencyCode,
}: {
  initial: boolean
  currencyCode: string
}) {
  const [enabled, setEnabled] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formattedPrice = convertToLocale({
    amount: GIFT_WRAP_PRICE,
    currency_code: currencyCode,
  })

  const onToggle = async () => {
    const next = !enabled
    setSaving(true)
    setError(null)
    // Optimistic toggle
    setEnabled(next)
    const res = await toggleGiftWrap(next)
    setSaving(false)
    if (!res.ok) {
      setEnabled(!next)
      setError(res.error || "Could not update gift wrap.")
    }
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      data-testid="gift-wrap-toggle"
      className={`w-full flex items-center gap-4 p-4 small:p-5 rounded-2xl border-2 text-left transition-all ${
        enabled
          ? "border-[var(--color-gold)] bg-[var(--color-gold)]/[0.08]"
          : "border-[var(--color-lavender)] bg-white hover:border-[var(--color-plum-light)]"
      } ${saving ? "opacity-70 cursor-wait" : "cursor-pointer"}`}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          enabled
            ? "bg-[var(--color-gold)] text-[var(--color-plum-deep)]"
            : "bg-[var(--color-lavender)] text-[var(--color-plum)]"
        }`}
      >
        {enabled ? <Check size={20} strokeWidth={2.4} /> : <Gift size={20} strokeWidth={1.5} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-wittgenstein text-[15px] small:text-[16px] font-bold text-[var(--color-plum)]">
            {enabled ? "Gift wrap added" : "Add gift wrap"}
          </span>
          <span className="text-[12px] font-semibold tabular-nums text-[var(--color-plum)] bg-[var(--color-lavender)] px-2 py-0.5 rounded-full">
            +{formattedPrice}
          </span>
        </div>
        <p className="text-[12.5px] text-[var(--color-text-secondary)] mt-1 leading-snug">
          Signature box, hand-tied ribbon, and a complimentary note card.
        </p>
        {error && (
          <p className="text-[11.5px] text-red-600 mt-1.5">{error}</p>
        )}
      </div>
      <div
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
          enabled ? "bg-[var(--color-gold)]" : "bg-[var(--color-border)]"
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
    </button>
  )
}
