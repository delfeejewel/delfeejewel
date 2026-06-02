import Image from "next/image"
import { Star, ShieldCheck, MessageSquarePlus } from "lucide-react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ReviewForm from "../review-form"
import type { PendingReview, SubmittedReview } from "../../types"

const FALLBACK = "/images/fallback-no-image.png"

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          fill={s <= rating ? "var(--color-gold)" : "none"}
          stroke={s <= rating ? "var(--color-gold)" : "var(--color-border)"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}

export default function AccountReviews({
  pending,
  submitted,
}: {
  pending: PendingReview[]
  submitted: SubmittedReview[]
}) {
  const nothing = pending.length === 0 && submitted.length === 0

  return (
    <div className="w-full" data-testid="reviews-page-wrapper">
      <header className="mb-8 tablet:mb-10">
        <h1 className="font-wittgenstein text-[28px] tablet:text-[36px] font-bold text-[var(--color-plum)] mb-1.5">
          My Reviews
        </h1>
        <p className="text-[14px] text-[var(--color-text-muted)]">
          Share your experience and help other shoppers choose with confidence.
        </p>
      </header>

      {nothing && (
        <div className="bg-white rounded-2xl border border-[var(--color-lavender)] flex flex-col items-center gap-4 py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--color-lavender)] flex items-center justify-center">
            <MessageSquarePlus
              className="w-6 h-6 text-[var(--color-plum)]"
              strokeWidth={1.6}
            />
          </div>
          <h2 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)]">
            No reviews yet
          </h2>
          <p className="text-[14px] text-[var(--color-text-muted)] max-w-sm">
            Once your orders are delivered, the pieces you bought will show up
            here for you to review.
          </p>
          <LocalizedClientLink
            href="/account/orders"
            className="mt-1 px-6 py-3 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 transition-all"
          >
            View My Orders
          </LocalizedClientLink>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <section className="mb-10">
          <h2 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)] mb-4">
            Waiting for your review ({pending.length})
          </h2>
          <div
            className="grid grid-cols-1 xsmall:grid-cols-2 gap-5"
            data-testid="pending-reviews"
          >
            {pending.map((p) => (
              <ReviewForm
                key={p.product_id}
                productId={p.product_id}
                orderId={p.order_id}
                productTitle={p.title}
                productThumbnail={p.thumbnail}
              />
            ))}
          </div>
        </section>
      )}

      {/* Submitted */}
      {submitted.length > 0 && (
        <section>
          <h2 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)] mb-4">
            Your reviews
          </h2>
          <div className="flex flex-col gap-4">
            {submitted.map((r) => (
              <article
                key={r.id}
                className="rounded-2xl bg-white border border-[var(--color-lavender)] p-5 flex gap-4"
              >
                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] shrink-0">
                  <Image
                    src={r.product_thumbnail || FALLBACK}
                    alt={r.product_title}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {r.product_handle ? (
                    <LocalizedClientLink
                      href={`/products/${r.product_handle}`}
                      className="text-[14px] font-semibold text-[var(--color-text-primary)] capitalize hover:text-[var(--color-plum)] transition-colors"
                    >
                      {r.product_title}
                    </LocalizedClientLink>
                  ) : (
                    <span className="text-[14px] font-semibold text-[var(--color-text-primary)] capitalize">
                      {r.product_title}
                    </span>
                  )}
                  <div className="flex items-center gap-2.5 mt-1.5 mb-2">
                    <Stars rating={r.rating} />
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-green-700">
                      <ShieldCheck size={12} />
                      Verified Purchase
                    </span>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                    {r.content}
                  </p>
                  <p className="text-[11.5px] text-[var(--color-text-muted)] mt-2">
                    {new Date(r.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
