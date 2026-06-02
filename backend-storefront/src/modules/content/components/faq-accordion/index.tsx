"use client"

import { useState } from "react"
import { Plus, Minus } from "lucide-react"

export type FaqItem = { question: string; answer: string }

export default function FaqAccordion({
  items,
  startOpen = 0,
}: {
  items: FaqItem[]
  startOpen?: number | null
}) {
  const [open, setOpen] = useState<number | null>(startOpen)

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const isOpen = open === i
        return (
          <div
            key={item.question}
            className="rounded-xl border border-[var(--color-lavender)] bg-white overflow-hidden transition-colors"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-[14px] small:text-[15px] font-semibold text-[var(--color-text-primary)]">
                {item.question}
              </span>
              <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center text-[var(--color-plum)]">
                {isOpen ? <Minus size={15} /> : <Plus size={15} />}
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 text-[14px] leading-[1.7] text-[var(--color-text-secondary)]">
                {item.answer}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
