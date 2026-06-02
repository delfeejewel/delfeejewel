"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { X, MessageSquarePlus } from "lucide-react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { PendingReview } from "../../types"

const FALLBACK = "/images/fallback-no-image.png"
const KEY = "review_popup_seen"

export default function ReviewPopup({ pending }: { pending: PendingReview[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!pending.length) return
    try {
      if (sessionStorage.getItem(KEY) === "1") return
    } catch {
      /* ignore */
    }
    setOpen(true)
  }, [pending.length])

  const close = () => {
    try {
      sessionStorage.setItem(KEY, "1")
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  if (!open || !pending.length) return null

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <X size={18} />
        </button>

        <div className="h-1 [background:var(--gradient-accent)]" />

        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--color-lavender)] mx-auto flex items-center justify-center mb-3">
            <MessageSquarePlus size={24} className="text-[var(--color-plum)]" />
          </div>
          <h3 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)]">
            How were your pieces?
          </h3>
          <p className="text-[13.5px] text-[var(--color-text-muted)] mt-1.5 mb-4">
            You have {pending.length} delivered{" "}
            {pending.length === 1 ? "piece" : "pieces"} waiting for a review.
            Your feedback helps other shoppers choose.
          </p>

          <div className="flex items-center justify-center gap-2 mb-5">
            {pending.slice(0, 4).map((p) => (
              <div
                key={p.product_id}
                className="relative w-12 h-12 rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-lavender)]"
              >
                <Image
                  src={p.thumbnail || FALLBACK}
                  alt={p.title}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
            ))}
            {pending.length > 4 && (
              <span className="text-[12px] text-[var(--color-text-muted)]">
                +{pending.length - 4}
              </span>
            )}
          </div>

          <LocalizedClientLink
            href="/account/reviews"
            onClick={close}
            className="block w-full py-3 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 transition-all"
          >
            Write Reviews
          </LocalizedClientLink>
          <button
            type="button"
            onClick={close}
            className="mt-2.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-plum)] transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
