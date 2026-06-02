"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const STARTING_PRICES: Record<string, string> = {
  rings: "₹999",
  earrings: "₹799",
  necklaces: "₹1,499",
  "bracelets-bangles": "₹1,299",
  mangalsutras: "₹2,499",
  solitaires: "₹3,999",
  "necklaces-pendants": "₹1,499",
  gifting: "₹999",
  collections: "₹999",
  anklets: "₹799",
}

type Category = {
  name: string
  handle: string
  cover_image?: string | null
  startingPrice?: string
}

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const update = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    update()
    el.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      el.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [update])

  if (!categories.length) return null

  return (
    <section className="py-10 small:py-16 bg-white">
      {/* Header */}
      <div className="page-container mb-8">
        <h2 className="font-wittgenstein text-[24px] small:text-[30px] text-[var(--color-plum)]">
          Shop by Category
        </h2>
        <div className="w-12 h-[2px] bg-[var(--color-gold)] mt-2.5 rounded-full" />
      </div>

      {/* Scroll wrapper — relative so gradients can be positioned over it */}
      <div className="relative">

        {/* Left fade */}
        <div
          className="absolute left-0 top-0 bottom-0 w-16 small:w-24 z-10 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: canScrollLeft ? 1 : 0,
            background: "linear-gradient(to right, white 0%, transparent 100%)",
          }}
        />

        {/* Right fade */}
        <div
          className="absolute right-0 top-0 bottom-0 w-16 small:w-24 z-10 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: canScrollRight ? 1 : 0,
            background: "linear-gradient(to left, white 0%, transparent 100%)",
          }}
        />

        {/* Scroll track */}
        <div ref={scrollRef} className="overflow-x-auto no-scrollbar">
          <div className="flex flex-row gap-5 small:gap-8 px-6 small:px-10 pt-4 pb-4">
            {categories.map((cat) => (
              <LocalizedClientLink
                key={cat.handle}
                href={`/categories/${cat.handle}`}
                className="group shrink-0 w-[160px] small:w-[200px] medium:w-[220px] flex flex-col items-center cursor-pointer"
              >
                {/* Circle */}
                <div className="w-full aspect-square rounded-full overflow-hidden bg-[var(--color-bg-secondary)] shadow-md group-hover:shadow-2xl group-hover:-translate-y-2 transition-all duration-500 ease-out">
                  <Image
                    src={cat.cover_image || "/images/fallback-no-image.png"}
                    alt={cat.name}
                    width={220}
                    height={220}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                </div>

                {/* Label */}
                <div className="mt-4 text-center">
                  <p className="font-semibold text-[14px] small:text-[15px] text-[var(--color-text-secondary)] group-hover:text-[var(--color-plum)] transition-colors">
                    {cat.name}
                  </p>
                  {(cat.startingPrice || STARTING_PRICES[cat.handle]) && (
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                      From {cat.startingPrice || STARTING_PRICES[cat.handle]}
                    </p>
                  )}
                </div>
              </LocalizedClientLink>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
