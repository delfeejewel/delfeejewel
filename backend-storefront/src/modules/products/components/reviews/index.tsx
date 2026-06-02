"use client"

import { useRef, useState, useMemo } from "react"
import { motion, useInView, AnimatePresence } from "framer-motion"
import {
  Star,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  MessageSquarePlus,
} from "lucide-react"

import type { ProductReview, ReviewSummary } from "@modules/reviews/types"

const REVIEWS_PER_PAGE = 4

// ─── Reusable Stars ──────────────────────────────────
function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          fill={s <= rating ? "var(--color-gold)" : "none"}
          stroke={s <= rating ? "var(--color-gold)" : "var(--color-border)"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}

// ─── Rating Bar ──────────────────────────────────────
function RatingBar({
  stars,
  count,
  total,
}: {
  stars: number
  count: number
  total: number
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-[var(--color-text-secondary)] w-8 text-right">
        {stars}&#9733;
      </span>
      <div className="flex-1 h-2 rounded-full bg-[var(--color-lavender)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-gold)] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-[var(--color-text-muted)] w-8">
        {count}
      </span>
    </div>
  )
}

// ─── Avatar ──────────────────────────────────────────
const AVATAR_COLORS = [
  "#5D2E46", "#D4AF37", "#6B5B95", "#88B04B",
  "#955251", "#009B77", "#B565A7", "#DD4124",
]

function Avatar({ name, index }: { name: string; index: number }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const bg = AVATAR_COLORS[index % AVATAR_COLORS.length]
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
      style={{ background: bg }}
    >
      {initials}
    </div>
  )
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

// ─── Review Card ─────────────────────────────────────
function ReviewCard({
  review,
  index,
}: {
  review: ProductReview
  index: number
}) {
  return (
    <motion.div
      className="p-6 rounded-xl bg-white border border-[var(--color-lavender)] hover:border-[var(--color-gold)]/30 hover:shadow-md transition-all duration-300"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: (index % REVIEWS_PER_PAGE) * 0.08 }}
    >
      <div className="flex items-center justify-between mb-3">
        <Stars rating={review.rating} />
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {fmtDate(review.created_at)}
        </span>
      </div>

      <p className="text-[13px] leading-[1.7] text-[var(--color-text-secondary)] mb-4">
        {review.content}
      </p>

      <div className="flex items-center pt-3 border-t border-[var(--color-lavender)]">
        <div className="flex items-center gap-3">
          <Avatar name={review.customer_name} index={index} />
          <div>
            <span className="text-[12px] font-semibold text-[var(--color-text-primary)] block leading-tight">
              {review.customer_name}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium mt-0.5">
              <CheckCircle size={10} /> Verified Purchase
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Reviews Component ──────────────────────────
export default function ProductReviews({
  reviews,
  summary,
}: {
  reviews: ProductReview[]
  summary: ReviewSummary
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  const [visibleCount, setVisibleCount] = useState(REVIEWS_PER_PAGE)
  const [filterRating, setFilterRating] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<"recent" | "highest" | "lowest">(
    "recent"
  )

  const totalReviews = summary.count
  const avgRating = (summary.average || 0).toFixed(1)
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: summary.breakdown?.[stars] ?? 0,
  }))

  const filteredReviews = useMemo(() => {
    let result = [...reviews]
    if (filterRating) result = result.filter((r) => r.rating === filterRating)
    if (sortBy === "highest") result.sort((a, b) => b.rating - a.rating)
    else if (sortBy === "lowest") result.sort((a, b) => a.rating - b.rating)
    else
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    return result
  }, [reviews, filterRating, sortBy])

  const visibleReviews = filteredReviews.slice(0, visibleCount)
  const hasMore = visibleCount < filteredReviews.length

  // ─── Empty state ───────────────────────────────────
  if (totalReviews === 0) {
    return (
      <div ref={ref} id="reviews">
        <div className="text-center mb-8">
          <span className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--color-gold)]">
            What customers say
          </span>
          <h2 className="font-wittgenstein text-[22px] small:text-[28px] medium:text-[32px] font-semibold text-[var(--color-text-primary)] mt-2">
            Customer Reviews
          </h2>
        </div>
        <div className="flex flex-col items-center text-center gap-3 py-14 px-6 rounded-2xl bg-white border border-[var(--color-lavender)]">
          <div className="w-14 h-14 rounded-full bg-[var(--color-lavender)] flex items-center justify-center">
            <MessageSquarePlus
              size={24}
              className="text-[var(--color-plum)]"
            />
          </div>
          <p className="font-wittgenstein text-[18px] font-semibold text-[var(--color-plum)]">
            No reviews yet
          </p>
          <p className="text-[13.5px] text-[var(--color-text-muted)] max-w-sm">
            This piece is waiting for its first review. Verified reviews appear
            here once customers receive their order.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} id="reviews">
      {/* Header */}
      <div className="text-center mb-12">
        <span className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--color-gold)]">
          What customers say
        </span>
        <h2 className="font-wittgenstein text-[22px] small:text-[28px] medium:text-[32px] font-semibold text-[var(--color-text-primary)] mt-2">
          Customer Reviews
        </h2>
      </div>

      {/* Summary card */}
      <motion.div
        className="grid grid-cols-1 medium:grid-cols-[260px_1fr] gap-10 mb-10 p-8 rounded-2xl bg-white border border-[var(--color-lavender)]"
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <span className="font-wittgenstein text-[52px] font-bold text-[var(--color-text-primary)] leading-none">
            {avgRating}
          </span>
          <div className="mt-2 mb-1">
            <Stars rating={Math.round(Number(avgRating))} size={18} />
          </div>
          <span className="text-[13px] text-[var(--color-text-muted)]">
            {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
          </span>
        </div>
        <div className="flex flex-col justify-center gap-2">
          {distribution.map(({ stars, count }) => (
            <button
              key={stars}
              onClick={() =>
                setFilterRating(filterRating === stars ? null : stars)
              }
              className={`transition-opacity ${
                filterRating && filterRating !== stars
                  ? "opacity-40"
                  : "opacity-100"
              }`}
            >
              <RatingBar stars={stars} count={count} total={totalReviews} />
            </button>
          ))}
        </div>
      </motion.div>

      {/* Filter + sort bar */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <SlidersHorizontal
            size={14}
            className="text-[var(--color-text-muted)]"
          />
          <span className="text-[12px] text-[var(--color-text-muted)]">
            {filterRating
              ? `Showing ${filterRating}★ reviews`
              : `All reviews`}
            {filterRating && (
              <button
                onClick={() => setFilterRating(null)}
                className="ml-2 text-[var(--color-plum)] underline underline-offset-2"
              >
                Clear
              </button>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--color-text-muted)]">
            Sort:
          </span>
          {(["recent", "highest", "lowest"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all duration-200 ${
                sortBy === s
                  ? "bg-[var(--color-plum)] text-white"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-lavender)]"
              }`}
            >
              {s === "recent"
                ? "Most Recent"
                : s === "highest"
                  ? "Highest First"
                  : "Lowest First"}
            </button>
          ))}
        </div>
      </div>

      {/* Review cards */}
      <div className="grid grid-cols-1 medium:grid-cols-2 gap-5">
        <AnimatePresence>
          {visibleReviews.map((review, i) => (
            <ReviewCard key={review.id} review={review} index={i} />
          ))}
        </AnimatePresence>
      </div>

      {/* Load more / Show less */}
      <div className="text-center mt-8">
        {hasMore && (
          <button
            onClick={() => setVisibleCount((c) => c + REVIEWS_PER_PAGE)}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-[13px] font-semibold border border-[var(--color-lavender)] text-[var(--color-text-secondary)] hover:border-[var(--color-plum)] hover:text-[var(--color-plum)] transition-all duration-200"
          >
            Show More Reviews <ChevronDown size={14} />
          </button>
        )}
        {!hasMore && visibleCount > REVIEWS_PER_PAGE && (
          <button
            onClick={() => setVisibleCount(REVIEWS_PER_PAGE)}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-[13px] font-semibold border border-[var(--color-lavender)] text-[var(--color-text-secondary)] hover:border-[var(--color-plum)] hover:text-[var(--color-plum)] transition-all duration-200"
          >
            Show Less <ChevronUp size={14} />
          </button>
        )}
        <p className="text-[11px] text-[var(--color-text-muted)] mt-2">
          Showing {visibleReviews.length} of {filteredReviews.length}
        </p>
      </div>
    </div>
  )
}
