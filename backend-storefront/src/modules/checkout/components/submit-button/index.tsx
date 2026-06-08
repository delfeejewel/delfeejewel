"use client"

import React from "react"
import { useFormStatus } from "react-dom"

type Variant = "primary" | "secondary"

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  isLoading = false,
  "data-testid": dataTestId,
}: {
  children: React.ReactNode
  variant?: Variant | null
  className?: string
  /** Force the loading state (e.g. from useActionState's isPending). */
  isLoading?: boolean
  "data-testid"?: string
}) {
  const { pending: formPending } = useFormStatus()
  const pending = formPending || isLoading
  const v: Variant = variant === "secondary" ? "secondary" : "primary"

  const base =
    "inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"

  const primary =
    "bg-[var(--color-gold)] text-[var(--color-plum-deep)] hover:brightness-105"
  const secondary =
    "border-2 border-[var(--color-plum)] text-[var(--color-plum)] hover:bg-[var(--color-plum)] hover:text-white"

  return (
    <button
      type="submit"
      disabled={pending}
      data-testid={dataTestId}
      className={`${base} ${v === "primary" ? primary : secondary} ${className}`}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Working…
        </span>
      ) : (
        children
      )}
    </button>
  )
}
