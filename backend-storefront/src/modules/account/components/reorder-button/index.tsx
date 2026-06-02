"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { RotateCcw, Check, AlertCircle } from "lucide-react"

import { reorderFromOrder } from "@lib/data/cart"

type Props = {
  orderId: string
  /** "ghost" = subtle button (orders list card); "primary" = filled (detail). */
  variant?: "ghost" | "primary"
  className?: string
}

export default function ReorderButton({
  orderId,
  variant = "ghost",
  className = "",
}: Props) {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  )
  const [message, setMessage] = useState("")

  const click = async () => {
    setStatus("loading")
    setMessage("")
    const res = await reorderFromOrder(orderId, countryCode)
    if (res.error) {
      setStatus("error")
      setMessage(res.error)
      return
    }
    if (res.added === 0) {
      setStatus("error")
      setMessage("Nothing could be added — items may no longer be available.")
      return
    }
    setStatus("done")
    const skipped = res.skipped.length
    setMessage(
      skipped > 0
        ? `${res.added} item${res.added === 1 ? "" : "s"} added · ${skipped} skipped`
        : `${res.added} item${res.added === 1 ? "" : "s"} added`
    )
    setTimeout(() => router.push(`/${countryCode}/cart`), 900)
  }

  const baseBtn =
    "inline-flex items-center justify-center gap-2 text-[12px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
  const styles =
    variant === "primary"
      ? "px-6 py-2.5 rounded-xl bg-[var(--color-plum)] text-white hover:bg-[var(--color-plum-deep)] active:scale-95"
      : "px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-plum)] hover:text-[var(--color-plum)]"

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        onClick={click}
        disabled={status === "loading" || status === "done"}
        className={`${baseBtn} ${styles}`}
        data-testid="reorder-button"
      >
        {status === "done" ? (
          <>
            <Check size={13} /> Added
          </>
        ) : status === "loading" ? (
          "Adding..."
        ) : (
          <>
            <RotateCcw size={13} /> Reorder
          </>
        )}
      </button>
      {message && (
        <p
          className={`text-[11px] inline-flex items-center gap-1 ${
            status === "error"
              ? "text-red-500"
              : "text-[var(--color-text-muted)]"
          }`}
        >
          {status === "error" && <AlertCircle size={11} />}
          {message}
        </p>
      )}
    </div>
  )
}
