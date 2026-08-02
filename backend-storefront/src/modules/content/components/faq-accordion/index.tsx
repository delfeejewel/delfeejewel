"use client"

import { useState } from "react"
import { Plus, Minus } from "lucide-react"

export type FaqItem = { question: string; answer: string }

/**
 * Answers are plain strings so they stay easy to author and to store in
 * category metadata, with two bits of light structure:
 *   - a blank line starts a new paragraph
 *   - a line beginning with "- " (or "• ") is a bullet
 * Single-paragraph answers render exactly as they always did.
 */
const BULLET_RE = /^\s*[-•]\s+/

/** "Chain Bracelets: Elegant and versatile…" → emphasise the leading label. */
const renderBullet = (text: string) => {
  const idx = text.indexOf(":")
  if (idx > 0 && idx <= 40) {
    return (
      <>
        <span className="font-semibold text-[var(--color-text-primary)]">
          {text.slice(0, idx)}
        </span>
        {text.slice(idx + 1)}
      </>
    )
  }
  return text
}

function AnswerBody({ answer }: { answer: string }) {
  const blocks = answer
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)

  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean)
        const isList = lines.length > 0 && lines.every((l) => BULLET_RE.test(l))

        if (isList) {
          return (
            <ul
              key={bi}
              className={`list-disc pl-5 space-y-1.5 ${bi > 0 ? "mt-3" : ""}`}
            >
              {lines.map((line, li) => (
                <li key={li} className="marker:text-[var(--color-gold)]">
                  {renderBullet(line.replace(BULLET_RE, ""))}
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={bi} className={bi > 0 ? "mt-3" : undefined}>
            {block.replace(/\n/g, " ")}
          </p>
        )
      })}
    </>
  )
}

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
              <span className="text-[0.875rem] small:text-[0.9375rem] font-semibold text-[var(--color-text-primary)]">
                {item.question}
              </span>
              <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center text-[var(--color-plum)]">
                {isOpen ? <Minus size={15} /> : <Plus size={15} />}
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 text-[0.875rem] leading-[1.7] text-[var(--color-text-secondary)]">
                <AnswerBody answer={item.answer} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
