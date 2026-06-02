"use client"

import { useState, useRef } from "react"
import { Tag, X, ChevronDown } from "lucide-react"

import { applyPromotions } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type DiscountCodeProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
}

const DiscountCode: React.FC<DiscountCodeProps> = ({ cart }) => {
  const { promotions = [] } = cart
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const removeCode = async (code: string) => {
    const remaining = promotions
      .filter((p) => p.code && p.code !== code)
      .map((p) => p.code!)
    await applyPromotions(remaining)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const code = inputRef.current?.value?.trim()
    if (!code) return

    const existing = promotions
      .filter((p) => p.code)
      .map((p) => p.code!)
    if (existing.includes(code)) {
      setError("This code is already applied.")
      return
    }

    setSubmitting(true)
    try {
      await applyPromotions([...existing, code])
      if (inputRef.current) inputRef.current.value = ""
    } catch (e: any) {
      setError(e?.message || "Invalid promotion code.")
    } finally {
      setSubmitting(false)
    }
  }

  const valueLabel = (p: HttpTypes.StorePromotion): string | null => {
    const am = p.application_method
    if (!am?.value) return null
    if (am.type === "percentage") return `${am.value}% off`
    if (am.currency_code) {
      return `− ${convertToLocale({
        amount: +am.value,
        currency_code: am.currency_code,
      })}`
    }
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      {promotions.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="discount-row">
          {promotions.map((p) => {
            const label = valueLabel(p)
            return (
              <span
                key={p.id}
                className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-[var(--color-lavender)] text-[var(--color-plum)] text-[12px] font-semibold"
              >
                <Tag size={12} />
                <span className="tracking-wider" data-testid="discount-code">
                  {p.code}
                </span>
                {label && (
                  <span className="font-medium opacity-75">· {label}</span>
                )}
                {!p.is_automatic && p.code && (
                  <button
                    type="button"
                    onClick={() => removeCode(p.code!)}
                    aria-label={`Remove ${p.code}`}
                    className="ml-0.5 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/60 transition-colors"
                    data-testid="remove-discount-button"
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
          data-testid="add-discount-button"
        >
          <Tag size={13} />
          Have a coupon code?
          <ChevronDown size={13} />
        </button>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              name="code"
              type="text"
              placeholder="ENTER CODE"
              className="flex-1 px-3.5 py-2.5 rounded-lg text-[13px] uppercase tracking-wider outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
              data-testid="discount-input"
              onChange={() => setError("")}
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-[var(--color-plum)] text-white text-[11.5px] font-bold uppercase tracking-wider hover:bg-[var(--color-plum-deep)] disabled:opacity-50 transition-all"
              data-testid="discount-apply-button"
            >
              {submitting ? "..." : "Apply"}
            </button>
          </div>
          {error && (
            <p
              className="text-[12px] text-red-500"
              data-testid="discount-error-message"
            >
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  )
}

export default DiscountCode
