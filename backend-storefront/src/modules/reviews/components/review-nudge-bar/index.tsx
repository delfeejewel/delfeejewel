"use client"

import { useState, useEffect } from "react"
import { X, Sparkles } from "lucide-react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

const KEY = "review_nudge_dismissed"

export default function ReviewNudgeBar({ count }: { count: number }) {
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setDismissed(sessionStorage.getItem(KEY) === "1")
    } catch {
      /* ignore */
    }
  }, [])

  if (!mounted || dismissed || count < 1) return null

  return (
    <div className="relative w-full [background:var(--gradient-accent)] text-[var(--color-plum-deep)]">
      <div className="content-container flex items-center justify-center gap-1.5 py-1.5 px-8 text-center">
        <Sparkles size={13} className="shrink-0" />
        <LocalizedClientLink
          href="/account/reviews"
          className="text-[12px] font-medium hover:underline"
        >
          You have {count} {count === 1 ? "piece" : "pieces"} waiting for your
          review — share your sparkle &#10024;
        </LocalizedClientLink>
      </div>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.setItem(KEY, "1")
          } catch {
            /* ignore */
          }
          setDismissed(true)
        }}
        aria-label="Dismiss"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  )
}
