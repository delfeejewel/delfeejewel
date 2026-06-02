"use client"

import { useState, useRef } from "react"
import { Gift, X, ChevronDown } from "lucide-react"

import {
  applyGiftCardToCart,
  removeGiftCardFromCart,
} from "@lib/data/gift-cards"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type CartWithCredit = HttpTypes.StoreCart & {
  credit_lines?: Array<{
    id: string
    amount: number
    reference?: string | null
    reference_id?: string | null
    metadata?: Record<string, any> | null
  }>
}

type Props = {
  cart: CartWithCredit
}

export default function GiftCardCode({ cart }: Props) {
  const giftLines = (cart.credit_lines || []).filter(
    (cl) => cl.reference === "gift_card"
  )

  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const code = inputRef.current?.value?.trim()
    if (!code) return

    setSubmitting(true)
    const res = await applyGiftCardToCart(code)
    setSubmitting(false)

    if (res.success) {
      if (inputRef.current) inputRef.current.value = ""
    } else {
      setError(res.error || "Could not apply gift card.")
    }
  }

  const remove = async (code: string) => {
    await removeGiftCardFromCart(code)
  }

  const last4 = (code?: string) => (code ? code.slice(-4) : "")

  return (
    <div className="flex flex-col gap-3">
      {giftLines.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="gift-card-row">
          {giftLines.map((cl) => {
            const code = (cl.metadata?.gift_card_code as string | undefined) || ""
            return (
              <span
                key={cl.id}
                className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-[var(--color-lavender)] text-[var(--color-plum)] text-[12px] font-semibold"
              >
                <Gift size={12} />
                <span className="tracking-wider" data-testid="gift-card-code">
                  ····{last4(code)}
                </span>
                <span className="font-medium opacity-75">
                  ·{" "}
                  {convertToLocale({
                    amount: Number(cl.amount) || 0,
                    currency_code: cart.currency_code,
                  })}{" "}
                  applied
                </span>
                {code && (
                  <button
                    type="button"
                    onClick={() => remove(code)}
                    aria-label="Remove gift card"
                    className="ml-0.5 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/60 transition-colors"
                    data-testid="remove-gift-card-button"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          className="self-start inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-plum)] hover:text-[var(--color-plum-deep)] transition-colors"
          data-testid="add-gift-card-button"
        >
          <Gift size={13} />
          Redeem a gift card
          <ChevronDown size={13} />
        </button>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              name="code"
              type="text"
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              className="flex-1 px-3.5 py-2.5 rounded-lg text-[13px] uppercase tracking-[0.15em] font-mono outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
              data-testid="gift-card-input"
              onChange={() => setError("")}
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-[var(--color-plum)] text-white text-[11.5px] font-bold uppercase tracking-wider hover:bg-[var(--color-plum-deep)] disabled:opacity-50 transition-all"
              data-testid="gift-card-apply-button"
            >
              {submitting ? "..." : "Apply"}
            </button>
          </div>
          {error && (
            <p
              className="text-[12px] text-red-500"
              data-testid="gift-card-error-message"
            >
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
