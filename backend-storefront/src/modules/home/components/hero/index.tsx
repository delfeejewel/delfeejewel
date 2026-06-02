"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type HeroSlide = {
  image_url: string
  title: string
  subtitle: string
  cta_text: string
  cta_link: string
  label?: string
}

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    image_url: "/images/ChatGPT Image May 21, 2026, 11_00_33 AM.png",
    label: "Festive Edit 2025",
    title: "Signature Silver Collection",
    subtitle: "Handcrafted elegance that bridges generations. Discover the timeless brilliance of 925 sterling silver inspired by Indian heritage.",
    cta_text: "Shop Now",
    cta_link: "/store",
  },
  {
    image_url: "/images/meigen-d3c8a47f-1bc2-4742-9f21-a50903341cc9.png",
    label: "New Arrivals",
    title: "Everyday Elegance",
    subtitle: "Lightweight, minimal silver pieces designed for the modern woman. From desk to dinner, effortlessly.",
    cta_text: "Explore Collection",
    cta_link: "/store",
  },
  {
    image_url: "/images/ChatGPT Image May 21, 2026, 10_49_22 AM.png",
    label: "Limited Edition",
    title: "The Bridal Edit",
    subtitle: "Heirloom-worthy silver jewellery for your most precious moments. Each piece tells a story of timeless love.",
    cta_text: "Shop Bridal",
    cta_link: "/store",
  },
]

const SLIDE_INTERVAL = 6000

export default function Hero({ slides, className }: { slides?: HeroSlide[], className?: string }) {
  const allSlides = slides?.length ? slides : DEFAULT_SLIDES
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(1)

  const goTo = useCallback((index: number) => {
    setDirection(index > current ? 1 : -1)
    setCurrent(index)
  }, [current])

  useEffect(() => {
    if (allSlides.length <= 1) return
    const id = setInterval(() => {
      setDirection(1)
      setCurrent((c) => (c + 1) % allSlides.length)
    }, SLIDE_INTERVAL)
    return () => clearInterval(id)
  }, [allSlides.length])

  const slide = allSlides[current]

  return (
    <section className={`relative w-full flex items-center overflow-hidden ${className ?? "h-[540px] tablet:h-[680px] small:h-[800px]"}`}>
      {/* Background images — crossfade */}
      <AnimatePresence mode="sync">
        <motion.div
          key={current}
          className="absolute inset-0 z-0"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        >
          <Image
            src={slide.image_url}
            alt={slide.title}
            fill
            className="object-cover"
            priority={current === 0}
            sizes="100vw"
          />
        </motion.div>
      </AnimatePresence>

      {/* Overlay layers — guarantee text contrast over any image */}
      {/* Subtle full-frame darkening tames bright slides */}
      <div className="absolute inset-0 z-[1] bg-black/20" />
      {/* Primary left-to-right scrim where the text sits */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(to right, rgba(67,24,48,0.92) 0%, rgba(67,24,48,0.62) 44%, rgba(67,24,48,0.12) 74%, transparent 100%)",
        }}
      />
      {/* Bottom fade for slide indicators */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 z-[1] bg-gradient-to-t from-black/45 to-transparent" />

      {/* Animated breeze — one soft, wide swell that drifts across like flowing light */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background:
            "linear-gradient(105deg, transparent 5%, rgba(67,24,48,0.16) 50%, transparent 95%)",
          backgroundSize: "200% 100%",
          animation: "hero-breeze 16s ease-in-out infinite",
        }}
      />

      {/* Content — fade + slide up per slide */}
      <div className="relative z-10 page-container">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            className="max-w-xl text-white"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          >
            {/* Label */}
            {slide.label && (
              <motion.span
                className="inline-block font-semibold text-[11px] tracking-[0.2em] uppercase mb-4 text-[var(--color-gold)] border border-[var(--color-gold)]/30 px-3 py-1 rounded-full"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                {slide.label}
              </motion.span>
            )}

            {/* Title */}
            <motion.h1
              className="font-wittgenstein text-[30px] tablet:text-[42px] small:text-[48px] medium:text-[56px] font-bold mb-5 leading-[1.1] [text-shadow:0_2px_20px_rgba(0,0,0,0.35)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
            >
              {slide.title}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="text-[15px] small:text-[17px] mb-8 text-white/90 leading-relaxed max-w-md [text-shadow:0_1px_12px_rgba(0,0,0,0.4)]"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              {slide.subtitle}
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
            >
              <LocalizedClientLink
                href={slide.cta_link}
                className="inline-block [background:var(--color-gold)] text-[var(--color-plum-deep)] px-10 py-3.5 rounded-full font-semibold text-[14px] tracking-wide hover:bg-white hover:text-[var(--color-plum)] transition-all duration-400 shadow-lg active:scale-95 hover:-translate-y-0.5"
              >
                {slide.cta_text}
              </LocalizedClientLink>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide indicators */}
      {allSlides.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5">
          {allSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="relative h-[3px] rounded-full overflow-hidden transition-all duration-500"
              style={{ width: i === current ? 40 : 16 }}
            >
              <div className="absolute inset-0 bg-white/30 rounded-full" />
              {i === current && (
                <motion.div
                  className="absolute inset-0 rounded-full [background:var(--color-gold)]"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: SLIDE_INTERVAL / 1000, ease: "linear" }}
                  style={{ transformOrigin: "left" }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
