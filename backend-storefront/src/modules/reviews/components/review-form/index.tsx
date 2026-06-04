"use client"

import { useState } from "react"
import Image from "next/image"
import { Star, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { submitReview } from "@lib/data/reviews"

const FALLBACK = "/images/fallback-no-image.png"

type Props = {
  productId: string
  orderId: string
  productTitle: string
  productThumbnail?: string | null
  /** Called after a successful submit. If omitted, the route is refreshed. */
  onDone?: () => void
}

export default function ReviewForm({
  productId,
  orderId,
  productTitle,
  productThumbnail,
  onDone,
}: Props) {
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [content, setContent] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1) {
      setError("Please tap a star to rate.")
      return
    }
    if (!content.trim()) {
      setError("Please write a few words about it.")
      return
    }
    setStatus("sending")
    const res = await submitReview({
      product_id: productId,
      order_id: orderId,
      rating,
      content: content.trim(),
    })
    if (res.success) {
      setStatus("done")
      setTimeout(() => {
        if (onDone) onDone()
        else router.refresh()
      }, 1100)
    } else {
      setStatus("idle")
      setError(res.error || "Something went wrong. Please try again.")
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl bg-white border border-[var(--color-lavender)] p-6 flex flex-col items-center text-center gap-2">
        <CheckCircle2 className="w-9 h-9 text-green-600" />
        <p className="font-wittgenstein text-[16px] font-semibold text-[var(--color-plum)]">
          Thanks for your review!
        </p>
      </div>
    )
  }

  const display = hover || rating

  return (
    <div
      className="rounded-2xl bg-white border border-[var(--color-lavender)] p-5"
      data-testid="review-form"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] shrink-0">
          <Image
            src={productThumbnail || FALLBACK}
            alt={productTitle}
            fill
            className="object-cover"
            sizes="48px"
          />
        </div>
        <p className="text-[14px] font-semibold text-[var(--color-text-primary)] capitalize line-clamp-2">
          {productTitle}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              onClick={() => {
                setRating(s)
                setError("")
              }}
              aria-label={`${s} star${s > 1 ? "s" : ""}`}
              className="p-0.5"
            >
              <Star
                size={26}
                fill={display >= s ? "var(--color-gold)" : "none"}
                stroke={
                  display >= s ? "var(--color-gold)" : "var(--color-border)"
                }
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>

        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            setError("")
          }}
          rows={3}
          maxLength={2000}
          placeholder="What did you love about it? How's the quality, finish and fit?"
          className="w-full px-4 py-2.5 rounded-lg text-[13.5px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all resize-y"
        />

        {error && (
          <p className="mt-2 text-[12.5px] text-red-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="mt-3 w-full py-2.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] disabled:opacity-50 transition-all"
        >
          {status === "sending" ? "Submitting..." : "Submit Review"}
        </button>
      </form>
    </div>
  )
}
