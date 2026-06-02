import { redirect } from "next/navigation"
import Image from "next/image"
import { ShoppingBag, Sparkles, ArrowRight, Clock } from "lucide-react"

import { retrieveCart } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const FALLBACK = "/images/fallback-no-image.png"

/**
 * Deep-link target from the abandoned-cart recovery email. Validates the
 * cart, restores it via cookie, and shows a brief welcome-back screen so
 * the customer sees an explicit acknowledgment that their cart was
 * recovered before continuing.
 */
type Params = Promise<{ countryCode: string; id: string }>

export default async function CartRecoverPage({ params }: { params: Params }) {
  const { countryCode, id } = await params

  // Bad/missing id → straight to home
  if (!id) redirect(`/${countryCode}`)

  let cart: any = null
  try {
    cart = await retrieveCart(
      id,
      "id,currency_code,subtotal,total,completed_at,items.id,items.title,items.variant_title,items.quantity,items.unit_price,items.thumbnail"
    )
  } catch {
    redirect(`/${countryCode}`)
  }

  // Cart gone, completed, or empty → redirect home
  if (
    !cart ||
    cart.completed_at ||
    !(cart.items?.length > 0)
  ) {
    redirect(`/${countryCode}`)
  }

  // Cart cookie was set by middleware before this page rendered.
  const items = cart.items as any[]
  const totalQty = items.reduce(
    (sum, it) => sum + Number(it.quantity || 0),
    0
  )

  return (
    <div className="font-outfit bg-[var(--color-bg-primary)]">
      {/* Hero */}
      <section className="relative overflow-hidden [background:linear-gradient(135deg,#faf9f7_0%,#f4f3f1_45%,#e6e2ee_100%)]">
        <div className="absolute -top-24 -right-16 w-64 h-64 tablet:w-96 tablet:h-96 rounded-full bg-[var(--color-gold)]/[0.10] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -left-20 w-64 h-64 tablet:w-96 tablet:h-96 rounded-full bg-[var(--color-plum)]/[0.08] blur-3xl pointer-events-none" />

        <div className="content-container relative z-10 py-10 xsmall:py-12 tablet:py-16 small:py-20 px-4 xsmall:px-6">
          <div className="max-w-2xl mx-auto text-center flex flex-col items-center">
            <div className="relative">
              <div className="w-16 h-16 xsmall:w-20 xsmall:h-20 tablet:w-24 tablet:h-24 rounded-full bg-[var(--color-lavender)] flex items-center justify-center border border-[var(--color-plum-light)]">
                <ShoppingBag
                  strokeWidth={1.4}
                  className="text-[var(--color-plum)] w-7 h-7 xsmall:w-8 xsmall:h-8 tablet:w-9 tablet:h-9"
                />
              </div>
              <Sparkles
                className="absolute -top-1 -right-1 text-[var(--color-gold)] w-4 h-4 xsmall:w-[18px] xsmall:h-[18px]"
                strokeWidth={1.8}
              />
            </div>

            <span className="text-[10px] xsmall:text-[11px] font-semibold uppercase tracking-[0.18em] xsmall:tracking-[0.2em] text-[var(--color-gold)] mt-5 xsmall:mt-6">
              Welcome back
            </span>
            <h1 className="font-wittgenstein text-[22px] xsmall:text-[26px] tablet:text-[32px] small:text-[38px] font-bold text-[var(--color-plum)] mt-2 leading-tight">
              Your cart is right where you left it
            </h1>
            <p className="text-[13px] xsmall:text-[14px] small:text-[15px] text-[var(--color-text-secondary)] mt-3 max-w-md">
              We kept your selection safe — {totalQty} {totalQty === 1 ? "item" : "items"} waiting for you.
            </p>
          </div>
        </div>
      </section>

      {/* Items preview + CTA */}
      <section className="content-container py-8 xsmall:py-10 small:py-12 px-4 xsmall:px-6">
        <div className="max-w-2xl mx-auto">
          <ul className="flex flex-col divide-y divide-[var(--color-lavender)] rounded-2xl bg-white border border-[var(--color-lavender)] overflow-hidden">
            {items.slice(0, 5).map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-3 xsmall:gap-4 p-3 xsmall:p-4 small:p-5"
              >
                <div className="relative w-14 h-14 xsmall:w-16 xsmall:h-16 rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] shrink-0 border border-[var(--color-border)]">
                  <Image
                    src={it.thumbnail || FALLBACK}
                    alt={it.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 512px) 56px, 64px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] xsmall:text-[13.5px] small:text-[14px] font-semibold text-[var(--color-text-primary)] line-clamp-2 xsmall:line-clamp-1 break-words">
                    {it.title}
                  </p>
                  {it.variant_title && (
                    <p className="text-[11px] xsmall:text-[11.5px] text-[var(--color-text-muted)] mt-0.5 line-clamp-1">
                      {it.variant_title}
                    </p>
                  )}
                  <p className="text-[11px] xsmall:text-[11.5px] text-[var(--color-text-muted)] mt-0.5">
                    Qty {it.quantity}
                  </p>
                </div>
                <p className="text-[12.5px] xsmall:text-[13.5px] font-bold text-[var(--color-plum)] tabular-nums whitespace-nowrap shrink-0">
                  {convertToLocale({
                    amount: Number(it.unit_price || 0) * Number(it.quantity || 0),
                    currency_code: cart.currency_code,
                  })}
                </p>
              </li>
            ))}

            {items.length > 5 && (
              <li className="px-4 xsmall:px-5 py-3 text-center text-[11.5px] xsmall:text-[12px] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]">
                + {items.length - 5} more {items.length - 5 === 1 ? "item" : "items"} in your cart
              </li>
            )}

            {/* Subtotal row */}
            <li className="flex items-center justify-between px-4 xsmall:px-5 py-3.5 xsmall:py-4 bg-[var(--color-bg-secondary)]">
              <span className="text-[11.5px] xsmall:text-[12.5px] uppercase tracking-[0.1em] xsmall:tracking-[0.12em] font-semibold text-[var(--color-text-muted)]">
                Subtotal
              </span>
              <span className="text-[15px] xsmall:text-[16px] font-bold text-[var(--color-plum)] tabular-nums">
                {convertToLocale({
                  amount: Number(cart.subtotal || cart.total || 0),
                  currency_code: cart.currency_code,
                })}
              </span>
            </li>
          </ul>

          {/* CTA */}
          <div className="flex flex-col xsmall:flex-row items-stretch xsmall:items-center justify-center gap-3 mt-6 xsmall:mt-8">
            <LocalizedClientLink
              href="/cart"
              className="inline-flex items-center justify-center gap-2 px-6 xsmall:px-8 py-3 xsmall:py-3.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[11.5px] xsmall:text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all"
            >
              Continue to cart
              <ArrowRight size={15} />
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/store"
              className="inline-flex items-center justify-center gap-2 px-6 xsmall:px-8 py-3 xsmall:py-3.5 rounded-full border-2 border-[var(--color-plum)] text-[var(--color-plum)] text-[11.5px] xsmall:text-[12px] font-bold uppercase tracking-wider hover:bg-[var(--color-plum)] hover:text-white transition-all"
            >
              Keep browsing
            </LocalizedClientLink>
          </div>

          {/* Reassurance */}
          <div className="flex items-start xsmall:items-center justify-center gap-2 mt-5 xsmall:mt-6 text-[11px] xsmall:text-[11.5px] text-[var(--color-text-muted)] px-2 xsmall:px-0">
            <Clock size={12} className="shrink-0 mt-[2px] xsmall:mt-0" />
            <span className="text-center">
              Prices and availability may have changed since you last visited.
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
