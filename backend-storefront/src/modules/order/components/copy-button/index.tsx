"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

export default function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard unavailable — ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 rounded text-[var(--color-plum)] hover:bg-[var(--color-plum)]/10 transition-colors"
      aria-label="Copy tracking ID"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}
