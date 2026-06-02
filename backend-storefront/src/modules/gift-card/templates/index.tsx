"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import {
  Gift,
  Mail,
  User,
  MessageSquare,
  ShoppingBag,
  Check,
  Sparkles,
} from "lucide-react"

import { addToCart } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import { BRAND } from "@lib/constants.brand"
import { HttpTypes } from "@medusajs/types"

type Props = {
  product: HttpTypes.StoreProduct
  customerEmail?: string | null
  customerName?: string | null
}

function gcValue(v: any): number {
  return Number(v?.metadata?.gift_card_value) || 0
}

export default function GiftCardTemplate({
  product,
  customerEmail: _ce,
  customerName,
}: Props) {
  const { countryCode } = useParams() as { countryCode: string }

  const variants = useMemo(
    () =>
      ((product.variants || []) as any[])
        .filter((v) => v.metadata?.is_gift_card)
        .sort((a, b) => gcValue(a) - gcValue(b)),
    [product]
  )
  const currencyCode =
    (variants[0]?.calculated_price?.currency_code as string) || "inr"

  const [variantId, setVariantId] = useState<string>(variants[0]?.id || "")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [purchaserName, setPurchaserName] = useState(customerName || "")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "adding" | "done">("idle")
  const [error, setError] = useState("")

  const selected = variants.find((v) => v.id === variantId)
  const value = gcValue(selected)
  const fmt = (a: number) => convertToLocale({ amount: a, currency_code: currencyCode })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!variantId) return setError("Choose a value to continue.")
    if (!recipientEmail.trim())
      return setError("Enter the recipient's email address.")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()))
      return setError("That doesn't look like a valid email.")

    setStatus("adding")
    try {
      await addToCart({
        variantId,
        quantity: 1,
        countryCode,
        metadata: {
          is_gift_card: true,
          gift_card_value: value,
          recipient_email: recipientEmail.trim(),
          recipient_name: recipientName.trim() || null,
          purchaser_name: purchaserName.trim() || null,
          message: message.trim() || null,
        },
      })
      setStatus("done")
      setTimeout(() => setStatus("idle"), 2500)
    } catch (e: any) {
      setError(e?.message || "Could not add to cart.")
      setStatus("idle")
    }
  }

  return (
    <div className="page-container py-10 small:py-16">
      <div className="grid grid-cols-1 medium:grid-cols-[1fr_1.05fr] gap-10 medium:gap-16">
        {/* ── Visual gift card ─────────────────────────── */}
        <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-[var(--color-plum-deep)] flex flex-col justify-between p-8 medium:p-10 text-white shadow-[0_30px_60px_rgba(93,46,70,0.25)]">
          {/* subtle background motif */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.18]">
            <svg className="absolute -top-10 -right-10 w-72 h-72" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth={0.4}>
              <path d="M2.5 9h19l-9.5 13L2.5 9zM2.5 9l4-5h11l4 5M7.5 4l4.5 5 4.5-5M12 9v13" />
            </svg>
            <svg className="absolute -bottom-12 -left-8 w-60 h-60" viewBox="0 0 24 24" fill="var(--color-gold)">
              <path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z" />
            </svg>
          </div>
          {/* top accent bar */}
          <div className="relative h-[2px] w-full [background:linear-gradient(90deg,transparent,var(--color-gold),transparent)]" />
          <div className="relative flex items-center gap-3">
            <Sparkles size={18} className="text-[var(--color-gold)]" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/70">
              {BRAND.name}
            </span>
          </div>
          <div className="relative flex-1 flex flex-col items-center justify-center text-center gap-3">
            <Gift size={56} className="text-[var(--color-gold)]" strokeWidth={1} />
            <p className="font-wittgenstein text-[40px] small:text-[52px] font-bold leading-tight">
              Gift Card
            </p>
            {selected && (
              <p className="font-wittgenstein text-[28px] text-[var(--color-gold)] font-semibold">
                {fmt(value)}
              </p>
            )}
            {recipientName && (
              <p className="text-[13px] text-white/70 mt-2">
                For <span className="text-white font-medium">{recipientName}</span>
              </p>
            )}
          </div>
          <div className="relative text-[10.5px] uppercase tracking-[0.2em] text-white/40 text-center">
            Delivered instantly · Valid for 1 year
          </div>
        </div>

        {/* ── Form ───────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <header>
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[var(--color-gold)]">
              Digital · Instant delivery
            </span>
            <h1 className="font-wittgenstein text-[32px] tablet:text-[44px] font-bold text-[var(--color-plum)] mt-2 mb-2">
              The Gift of Choice
            </h1>
            <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
              {product.description ||
                "Let them pick the piece they'll treasure forever. Delivered by email, redeemable anytime within a year."}
            </p>
          </header>

          {/* Denomination chips */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-2.5">
              Choose value
            </p>
            <div className="grid grid-cols-2 xsmall:grid-cols-4 gap-2.5">
              {variants.map((v) => {
                const active = v.id === variantId
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    className={`relative py-3 rounded-xl text-[14px] font-semibold transition-all border ${
                      active
                        ? "bg-[var(--color-plum)] text-white border-[var(--color-plum)]"
                        : "bg-white text-[var(--color-text-primary)] border-[var(--color-border)] hover:border-[var(--color-plum)]"
                    }`}
                  >
                    {fmt(gcValue(v))}
                    {active && (
                      <Check
                        size={11}
                        className="absolute top-1.5 right-1.5 text-[var(--color-gold)]"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="flex flex-col gap-3.5">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] flex items-center gap-1.5 mb-1.5">
                <Mail size={11} /> Recipient&apos;s email
              </label>
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => {
                  setRecipientEmail(e.target.value)
                  setError("")
                }}
                placeholder="them@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg text-[13.5px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 xsmall:grid-cols-2 gap-3.5">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] flex items-center gap-1.5 mb-1.5">
                  <User size={11} /> Recipient&apos;s name
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3.5 py-2.5 rounded-lg text-[13.5px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] flex items-center gap-1.5 mb-1.5">
                  <User size={11} /> From
                </label>
                <input
                  type="text"
                  value={purchaserName}
                  onChange={(e) => setPurchaserName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3.5 py-2.5 rounded-lg text-[13.5px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] flex items-center gap-1.5 mb-1.5">
                <MessageSquare size={11} /> Personal message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={250}
                placeholder="Optional — a few words for them"
                className="w-full px-3.5 py-2.5 rounded-lg text-[13.5px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all resize-y"
              />
              <p className="text-[10.5px] text-[var(--color-text-muted)] mt-1 text-right">
                {message.length}/250
              </p>
            </div>

            {error && (
              <p className="text-[12.5px] text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={status === "adding" || !variantId}
              className={`inline-flex items-center justify-center gap-2 py-3.5 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                status === "done"
                  ? "bg-green-600 text-white"
                  : "bg-[var(--color-gold)] text-[var(--color-plum-deep)] hover:brightness-105 active:scale-[0.98]"
              }`}
            >
              {status === "done" ? (
                <>
                  <Check size={15} /> Added to Cart
                </>
              ) : status === "adding" ? (
                "Adding..."
              ) : (
                <>
                  <ShoppingBag size={15} />
                  {selected ? `Add ${fmt(value)} Gift Card to Cart` : "Add to Cart"}
                </>
              )}
            </button>
          </form>

          {/* How it works */}
          <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-5 small:p-6 border border-[var(--color-border)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-plum)] mb-3">
              How it works
            </p>
            <ol className="space-y-2.5 text-[13px] text-[var(--color-text-secondary)]">
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-lavender)] text-[var(--color-plum)] text-[10.5px] font-bold flex items-center justify-center">
                  1
                </span>
                Pick a value, write a note, and check out.
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-lavender)] text-[var(--color-plum)] text-[10.5px] font-bold flex items-center justify-center">
                  2
                </span>
                Your recipient gets a unique code by email — instantly.
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-lavender)] text-[var(--color-plum)] text-[10.5px] font-bold flex items-center justify-center">
                  3
                </span>
                They redeem at checkout. Multi-use — leftover balance carries over.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
