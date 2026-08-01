"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

// Static banners — the artwork carries its own copy, so no overlay text.
const SLIDES = [
  { image_url: "/images/hero-banner-1.jpg", alt: "Rakhi Edit — 15% off with code RAKSHA", link: "/store" },
  { image_url: "/images/hero-banner-2.jpg", alt: "A Promise That Lasts Forever — 15% off with code ETERNAL", link: "/store" },
  { image_url: "/images/hero-banner-3.jpg", alt: "Elegance You Can Wear Every Day — 15% off with code EVERYDAY", link: "/store" },
]

const SLIDE_INTERVAL = 5000

export default function Hero({ className }: { className?: string }) {
  const [current, setCurrent] = useState(0)

  const goTo = useCallback((index: number) => setCurrent(index), [])

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length)
    }, SLIDE_INTERVAL)
    return () => clearInterval(id)
  }, [])

  return (
    <section
      className={`relative w-full overflow-hidden ${className ?? "aspect-[2000/469]"}`}
    >
      {/* Banner images — all mounted so none flashes blank on its first turn; crossfade by opacity */}
      {SLIDES.map((s, i) => (
        <motion.div
          key={s.image_url}
          className="absolute inset-0 z-0"
          initial={false}
          animate={{ opacity: i === current ? 1 : 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          style={{ pointerEvents: i === current ? "auto" : "none" }}
          aria-hidden={i !== current}
        >
          <LocalizedClientLink href={s.link} className="block relative w-full h-full">
            <Image
              src={s.image_url}
              alt={s.alt}
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
          </LocalizedClientLink>
        </motion.div>
      ))}

      {/* Slide indicators */}
      <div className="absolute bottom-2 small:bottom-4 right-4 small:right-8 z-20 flex items-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className="relative h-[3px] rounded-full overflow-hidden transition-all duration-500"
            style={{ width: i === current ? 32 : 14 }}
          >
            <div className="absolute inset-0 bg-[var(--color-plum)]/25 rounded-full" />
            {i === current && (
              <div className="absolute inset-0 rounded-full [background:var(--color-plum)]" />
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
