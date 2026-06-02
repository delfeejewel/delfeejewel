"use client"

import { useRef, useEffect, useCallback } from "react"
import { motion } from "framer-motion"

const CATEGORY_META: Record<string, { tagline: string }> = {
  rings: { tagline: "Crafted to perfection, worn with pride" },
  earrings: { tagline: "Frame your face with elegance" },
  necklaces: { tagline: "Adorn your neckline with timeless beauty" },
  bracelets: { tagline: "Grace your wrist with every gesture" },
  solitaires: { tagline: "Brilliance that speaks for itself" },
  mangalsutras: { tagline: "A bond of love, in every bead" },
}

// ─── Floating particles canvas ───────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<{ x: number; y: number; r: number; vx: number; vy: number; o: number }[]>([])
  const raf = useRef<number>(0)

  const init = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    particles.current = Array.from({ length: 25 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      o: Math.random() * 0.25 + 0.05,
    }))
  }, [])

  useEffect(() => {
    init()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.current.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(212, 175, 55, ${p.o})`
        ctx.fill()
      })
      raf.current = requestAnimationFrame(draw)
    }
    draw()

    window.addEventListener("resize", init)
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener("resize", init) }
  }, [init])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}

export default function CategoryHero({
  name,
  handle,
  description,
  productCount,
}: {
  name: string
  handle: string
  description?: string
  productCount: number
}) {
  const meta = CATEGORY_META[handle] || { tagline: "Discover our curated collection" }

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, var(--color-lavender) 0%, var(--color-bg-secondary) 55%, var(--color-bg-primary) 100%)",
        minHeight: 180,
      }}
    >
      <ParticleCanvas />

      {/* Animated orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[300px] h-[300px] rounded-full" style={{ background: "radial-gradient(circle, rgba(93,46,70,0.07) 0%, transparent 70%)", right: "-5%", top: "-20%", animation: "cat-hero-orb 20s ease-in-out infinite" }} />
        <div className="absolute w-[200px] h-[200px] rounded-full" style={{ background: "radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)", left: "15%", bottom: "-15%", animation: "cat-hero-orb 25s ease-in-out infinite reverse" }} />
      </div>
      <style>{`@keyframes cat-hero-orb { 0%, 100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(30px,-20px,0) scale(1.1); } }`}</style>

      <div className="relative z-10 content-container py-10 small:py-12">
        <motion.h1
          className="font-wittgenstein text-3xl small:text-[44px] tracking-tight leading-[1.1] mb-3"
          style={{ color: "var(--color-text-primary)" }}
          initial="hidden"
          animate="visible"
        >
          {name.split(" ").map((word, i) => (
            <motion.span
              key={i}
              className="inline-block mr-[0.3em]"
              variants={{ hidden: { opacity: 0, y: 20, filter: "blur(6px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)" } }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          className="text-sm small:text-base max-w-md"
          style={{ color: "var(--color-text-secondary)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {description || meta.tagline}
        </motion.p>

        <motion.div
          className="flex items-center gap-3 mt-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <span
            className="text-[12px] px-3.5 py-1.5 rounded-full font-medium"
            style={{
              background: "var(--color-lavender)",
              color: "var(--color-plum)",
              border: "1px solid var(--color-plum-light)",
            }}
          >
            {productCount} product{productCount !== 1 ? "s" : ""}
          </span>
        </motion.div>
      </div>
    </section>
  )
}
