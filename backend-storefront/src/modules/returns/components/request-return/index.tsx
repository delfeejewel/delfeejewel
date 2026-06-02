"use client"

import { useState, useMemo, useEffect } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import {
  Undo2,
  X,
  CheckCircle2,
  Minus,
  Plus,
  AlertCircle,
} from "lucide-react"

import {
  createReturnRequest,
  getExchangeVariantsForProducts,
} from "@lib/data/returns"
import {
  RETURN_REASON_LABELS,
  type ReturnReason,
  type ExchangeVariantOption,
} from "@modules/returns/types"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

const FALLBACK = "/images/fallback-no-image.png"
const RETURN_WINDOW_DAYS = 15

type RequestType = "refund" | "exchange"
type Props = {
  order: HttpTypes.StoreOrder
}

function isWithinWindow(deliveredAt: string | null | undefined, nowMs: number): boolean {
  if (!deliveredAt) return false
  const age = nowMs - new Date(deliveredAt).getTime()
  return age >= 0 && age < RETURN_WINDOW_DAYS * 86400_000
}

function daysLeft(deliveredAt: string | null | undefined, nowMs: number): number {
  if (!deliveredAt) return 0
  const age = nowMs - new Date(deliveredAt).getTime()
  return Math.max(
    0,
    Math.ceil((RETURN_WINDOW_DAYS * 86400_000 - age) / 86400_000)
  )
}

export default function RequestReturn({ order }: Props) {
  const meta = (order.metadata || {}) as any
  const deliveredAt = meta.delivered_at as string | undefined

  // Read "now" only on the client to avoid SSR/hydration mismatch. Before mount
  // we treat the order as not yet eligible — the conditional return at the
  // bottom will render nothing on the server, then re-evaluate after mount.
  const [nowMs, setNowMs] = useState<number | null>(null)
  useEffect(() => {
    setNowMs(Date.now())
  }, [])
  const eligible = nowMs !== null && isWithinWindow(deliveredAt, nowMs)
  const daysRemaining = nowMs !== null ? daysLeft(deliveredAt, nowMs) : 0

  const params = useParams() as { countryCode?: string }
  const countryCode = params?.countryCode || ""

  const [open, setOpen] = useState(false)
  const [requestType, setRequestType] = useState<RequestType>("refund")
  const [selected, setSelected] = useState<
    Record<string, { quantity: number; exchange_variant_id?: string }>
  >({})
  const [reason, setReason] = useState<ReturnReason | "">("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const items = (order.items || []) as any[]

  // Pre-fetch exchange variants once when the dialog opens, keyed by product_id.
  const [variantsByProduct, setVariantsByProduct] = useState<
    Record<string, ExchangeVariantOption[]>
  >({})
  const [variantsLoading, setVariantsLoading] = useState(false)
  useEffect(() => {
    if (!open || requestType !== "exchange") return
    if (Object.keys(variantsByProduct).length) return
    const productIds = Array.from(
      new Set(items.map((it: any) => it.product_id).filter(Boolean))
    )
    if (!productIds.length) return
    setVariantsLoading(true)
    getExchangeVariantsForProducts(productIds, countryCode)
      .then((r) => setVariantsByProduct(r))
      .catch(() => {})
      .finally(() => setVariantsLoading(false))
  }, [open, requestType, items, countryCode, variantsByProduct])

  // Eligible exchange variants for a given line item:
  // same product, different variant, same price, in stock.
  const eligibleVariantsFor = (
    item: any
  ): ExchangeVariantOption[] => {
    const all = variantsByProduct[item.product_id] || []
    const unit = Number(item.unit_price) || 0
    return all.filter(
      (v) =>
        v.id !== item.variant_id &&
        v.in_stock &&
        Number.isFinite(v.price) &&
        v.price === unit
    )
  }

  const total = useMemo(() => {
    return items.reduce((sum, it) => {
      const sel = selected[it.id]
      if (!sel) return sum
      return sum + (Number(it.unit_price) || 0) * sel.quantity
    }, 0)
  }, [selected, items])

  const toggle = (item: any) => {
    setSelected((s) => {
      if (s[item.id]) {
        const { [item.id]: _drop, ...rest } = s
        return rest
      }
      return { ...s, [item.id]: { quantity: 1 } }
    })
  }
  const setQty = (id: string, q: number, max: number) => {
    if (q < 1 || q > max) return
    setSelected((s) => ({ ...s, [id]: { quantity: q } }))
  }

  const submit = async () => {
    setError("")
    const picks = Object.entries(selected).map(([line_item_id, v]) => ({
      line_item_id,
      quantity: v.quantity,
      exchange_variant_id: v.exchange_variant_id,
    }))
    if (!picks.length) return setError("Select at least one item to return.")
    if (!reason) return setError("Pick a reason.")
    if (requestType === "exchange") {
      const missing = picks.find((p) => !p.exchange_variant_id)
      if (missing) {
        return setError(
          "Pick a replacement variant for every item you want to exchange."
        )
      }
    }

    setSubmitting(true)
    const res = await createReturnRequest({
      order_id: order.id,
      reason: reason as ReturnReason,
      message: message.trim() || undefined,
      type: requestType,
      items: picks,
    })
    setSubmitting(false)
    if (res.success) setDone(true)
    else setError(res.error || "Submission failed.")
  }

  if (!eligible) return null

  return (
    <>
      <div className="rounded-2xl bg-white border border-[var(--color-lavender)] p-5 small:p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--color-lavender)] flex items-center justify-center shrink-0">
            <Undo2 className="w-5 h-5 text-[var(--color-plum)]" />
          </div>
          <div className="flex-1">
            <p className="font-wittgenstein text-[16px] font-semibold text-[var(--color-plum)]">
              Not quite right? Start a return or exchange.
            </p>
            <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5">
              {daysRemaining > 0
                ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left in your return window.`
                : "Return window closed."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-5 py-2.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[11.5px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all"
            data-testid="request-return-button"
          >
            Return / Exchange
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => !submitting && setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <X size={18} />
            </button>

            {done ? (
              <div className="p-8 text-center flex flex-col items-center gap-3">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
                <h3 className="font-wittgenstein text-[22px] font-semibold text-[var(--color-plum)]">
                  {requestType === "exchange"
                    ? "Exchange request submitted"
                    : "Return request submitted"}
                </h3>
                <p className="text-[13.5px] text-[var(--color-text-secondary)] max-w-sm">
                  We&apos;ll review and email you next steps within 1–2
                  business days. You can track its status under{" "}
                  <strong>My Account → Returns</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setDone(false)
                    setSelected({})
                    setReason("")
                    setMessage("")
                  }}
                  className="mt-2 px-6 py-2.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[11.5px] font-bold uppercase tracking-wider"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <header className="px-6 small:px-7 pt-6 pb-4 border-b border-[var(--color-border)]">
                  <h3 className="font-wittgenstein text-[22px] font-bold text-[var(--color-plum)]">
                    {requestType === "exchange"
                      ? "Request an Exchange"
                      : "Request a Return"}
                  </h3>
                  <p className="text-[12.5px] text-[var(--color-text-muted)] mt-1">
                    {requestType === "exchange"
                      ? "Swap for a different size or colour of the same product."
                      : "Pick the items you'd like to send back."}
                  </p>
                </header>

                <div className="px-6 small:px-7 py-5 flex flex-col gap-5">
                  {/* Type toggle */}
                  <div
                    role="tablist"
                    className="inline-flex p-1 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] self-start"
                  >
                    {(["refund", "exchange"] as RequestType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="tab"
                        aria-selected={requestType === t}
                        onClick={() => setRequestType(t)}
                        className={`px-4 py-1.5 rounded-full text-[11.5px] font-bold uppercase tracking-wider transition-all ${
                          requestType === t
                            ? "bg-[var(--color-plum)] text-white"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-plum)]"
                        }`}
                      >
                        {t === "refund" ? "Refund" : "Exchange"}
                      </button>
                    ))}
                  </div>

                  {/* Items */}
                  <div className="flex flex-col gap-3">
                    {items.map((it) => {
                      const sel = selected[it.id]
                      const checked = !!sel
                      const eligible =
                        requestType === "exchange" && checked
                          ? eligibleVariantsFor(it)
                          : []
                      return (
                        <div
                          key={it.id}
                          className={`rounded-xl border transition-all ${
                            checked
                              ? "border-[var(--color-gold)] bg-[var(--color-gold)]/[0.04]"
                              : "border-[var(--color-border)] hover:border-[var(--color-plum)]/30"
                          }`}
                        >
                          <label className="flex items-start gap-3 p-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(it)}
                              className="mt-1 w-4 h-4 accent-[var(--color-plum)]"
                            />
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
                                Bought: {it.quantity} ·{" "}
                                {convertToLocale({
                                  amount: Number(it.unit_price) || 0,
                                  currency_code: order.currency_code,
                                })}
                              </p>
                            </div>
                            {checked && (
                              <div
                                className="flex items-center gap-1.5 shrink-0"
                                onClick={(e) => e.preventDefault()}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQty(it.id, sel.quantity - 1, it.quantity)
                                  }
                                  className="w-7 h-7 rounded-md bg-white border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
                                  disabled={sel.quantity <= 1}
                                >
                                  <Minus size={11} />
                                </button>
                                <span className="w-6 text-center text-[13px] font-semibold tabular-nums">
                                  {sel.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQty(it.id, sel.quantity + 1, it.quantity)
                                  }
                                  className="w-7 h-7 rounded-md bg-white border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
                                  disabled={sel.quantity >= it.quantity}
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            )}
                          </label>
                          {requestType === "exchange" && checked && (
                            <div className="px-3 pb-3 -mt-1">
                              <label className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5 block">
                                Exchange for
                              </label>
                              {variantsLoading ? (
                                <p className="text-[12px] text-[var(--color-text-muted)] italic">
                                  Loading options…
                                </p>
                              ) : eligible.length === 0 ? (
                                <p className="text-[12px] text-amber-700">
                                  No same-price variants in stock right now. Try
                                  a refund instead.
                                </p>
                              ) : (
                                <select
                                  value={sel.exchange_variant_id || ""}
                                  onChange={(e) =>
                                    setSelected((s) => ({
                                      ...s,
                                      [it.id]: {
                                        ...s[it.id],
                                        exchange_variant_id:
                                          e.target.value || undefined,
                                      },
                                    }))
                                  }
                                  className="w-full px-3 py-2 rounded-lg text-[13px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
                                >
                                  <option value="">Pick a variant…</option>
                                  {eligible.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.title}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5 block">
                      Reason
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value as ReturnReason)}
                      className="w-full px-3.5 py-2.5 rounded-lg text-[13.5px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
                    >
                      <option value="">Pick a reason…</option>
                      {Object.entries(RETURN_REASON_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5 block">
                      Additional details (optional)
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Anything we should know?"
                      className="w-full px-3.5 py-2.5 rounded-lg text-[13.5px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all resize-y"
                    />
                  </div>

                  {total > 0 && requestType === "refund" && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                      <span className="text-[12.5px] text-[var(--color-text-secondary)]">
                        Estimated refund
                      </span>
                      <span className="text-[15px] font-bold text-[var(--color-plum)] tabular-nums">
                        {convertToLocale({
                          amount: total,
                          currency_code: order.currency_code,
                        })}
                      </span>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                      <AlertCircle
                        size={14}
                        className="text-red-500 mt-0.5 shrink-0"
                      />
                      <p className="text-[12.5px] text-red-600">{error}</p>
                    </div>
                  )}
                </div>

                <footer className="px-6 small:px-7 pb-6 pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-full border border-[var(--color-border)] text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] disabled:opacity-50 transition-all"
                  >
                    {submitting
                      ? "Submitting..."
                      : requestType === "exchange"
                      ? "Submit Exchange"
                      : "Submit Request"}
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
