"use client"

import { useEffect, useState, type FormEvent } from "react"
import Image from "next/image"

const PROMISES = ["925 Silver", "Anti-Tarnish", "Made in India"]

const SLIDES = [
  {
    src: "/images/coming-soon_1.png",
    eyebrow: "First glimpse",
    title: "Crafted to be worn forever.",
    alt: "Sterling silver knot pendant on rich plum velvet with magenta bokeh",
  },
  {
    src: "/images/coming-soon_2.png",
    eyebrow: "Heirloom in waiting",
    title: "Made for the moments that matter.",
    alt: "Layered fine silver necklaces with brilliant-cut stones on an ivory embroidered blouse",
  },
  {
    src: "/images/coming-soon_3.png",
    eyebrow: "Everyday gleam",
    title: "Designed for the way you live.",
    alt: "Hand resting on cream silk, wearing three delicate sterling silver rings",
  },
  {
    src: "/images/coming-soon_4.png",
    eyebrow: "By human hands",
    title: "Hand-finished, one piece at a time.",
    alt: "Craftsman setting a stone into a silver ring at a candle-lit workbench",
  },
  {
    src: "/images/coming-soon_5.png",
    eyebrow: "Pure brilliance",
    title: "Where light meets silver.",
    alt: "Macro of a brilliant-cut solitaire pendant with refracted rainbow sparkles",
  },
]

function CornerOrnament({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right"
}) {
  const placement = {
    "top-left": "top-2.5 left-2.5 border-t border-l rounded-tl-md",
    "top-right": "top-2.5 right-2.5 border-t border-r rounded-tr-md",
    "bottom-left": "bottom-2.5 left-2.5 border-b border-l rounded-bl-md",
    "bottom-right": "bottom-2.5 right-2.5 border-b border-r rounded-br-md",
  }[position]
  return (
    <span
      aria-hidden="true"
      className={`absolute w-3 h-3 xsmall:w-4 xsmall:h-4 border-[var(--color-gold)]/70 ${placement} pointer-events-none`}
    />
  )
}

function FloatingIcons() {
  const gold = "var(--color-gold)"
  const plum = "var(--color-plum)"
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none hidden xsmall:block"
      aria-hidden="true"
    >
      {/* Diamond — top left */}
      <svg
        className="deco-anim absolute top-12 left-[5%] w-16 h-16 tablet:w-20 tablet:h-20 opacity-[0.10]"
        style={{ animation: "deco-drift 27s ease-in-out infinite" }}
        viewBox="0 0 24 24" fill="none" stroke={plum} strokeWidth={0.6}
      >
        <path d="M2.5 9h19l-9.5 13L2.5 9zM2.5 9l4-5h11l4 5M7.5 4l4.5 5 4.5-5M12 9v13" />
      </svg>

      {/* Ring — top right */}
      <svg
        className="deco-anim absolute top-20 right-[8%] w-20 h-20 tablet:w-24 tablet:h-24 opacity-[0.10]"
        style={{ animation: "deco-drift-alt 32s ease-in-out -7s infinite" }}
        viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={0.6}
      >
        <circle cx="12" cy="14" r="8" />
        <ellipse cx="12" cy="14" rx="4" ry="8" />
        <path d="M8 6.5c1-1.5 2.5-2.5 4-2.5s3 1 4 2.5" />
      </svg>

      {/* Crown — bottom left */}
      <svg
        className="deco-anim absolute bottom-24 left-[10%] w-16 h-16 tablet:w-20 tablet:h-20 opacity-[0.10]"
        style={{ animation: "deco-drift-alt 30s ease-in-out -4s infinite" }}
        viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={0.7}
      >
        <path d="M2 20h20M4 20l1-12 4 5 3-9 3 9 4-5 1 12" />
      </svg>

      {/* Gem — bottom right */}
      <svg
        className="deco-anim absolute bottom-16 right-[12%] w-14 h-14 tablet:w-16 tablet:h-16 opacity-[0.11]"
        style={{ animation: "deco-drift 25s ease-in-out -11s infinite" }}
        viewBox="0 0 24 24" fill="none" stroke={plum} strokeWidth={0.7}
      >
        <polygon points="12,2 22,8.5 17,22 7,22 2,8.5" />
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="8.5" x2="22" y2="8.5" />
      </svg>

      {/* Sparkle star — mid left */}
      <svg
        className="deco-anim absolute top-[45%] left-[3%] w-10 h-10 tablet:w-14 tablet:h-14 opacity-[0.14]"
        style={{ animation: "deco-drift 22s ease-in-out -3s infinite" }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z" />
      </svg>

      {/* Pearl cluster — mid right */}
      <svg
        className="deco-anim absolute top-[30%] right-[3%] w-12 h-12 tablet:w-16 tablet:h-16 opacity-[0.10]"
        style={{ animation: "deco-drift 29s ease-in-out -9s infinite" }}
        viewBox="0 0 24 24" fill={plum}
      >
        <circle cx="12" cy="12" r="5" />
        <circle cx="6" cy="8" r="2.5" />
        <circle cx="18" cy="8" r="2.5" />
        <circle cx="8" cy="18" r="2" />
        <circle cx="16" cy="18" r="2" />
      </svg>

      {/* Twinkling stars */}
      <svg
        className="deco-anim absolute top-[62%] right-[28%] w-6 h-6 tablet:w-8 tablet:h-8"
        style={{ animation: "deco-twinkle 7s ease-in-out infinite", opacity: 0.18 }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
      <svg
        className="deco-anim absolute top-[18%] left-[32%] w-5 h-5 tablet:w-6 tablet:h-6"
        style={{ animation: "deco-twinkle 6s ease-in-out -3s infinite", opacity: 0.20 }}
        viewBox="0 0 24 24" fill={plum}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
      <svg
        className="deco-anim absolute bottom-[34%] left-[52%] w-7 h-7 tablet:w-10 tablet:h-10"
        style={{ animation: "deco-twinkle 8s ease-in-out -1.5s infinite", opacity: 0.15 }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
    </div>
  )
}

export default function ComingSoonClient({ brandName }: { brandName: string }) {
  const [slideIdx, setSlideIdx] = useState(0)

  // ─── Team / QA access (preview the real site while coming-soon is on) ───
  const [accessOpen, setAccessOpen] = useState(false)
  const [token, setToken] = useState("")
  const [accessStatus, setAccessStatus] = useState<"idle" | "loading" | "error">("idle")
  const [accessError, setAccessError] = useState("")

  useEffect(() => {
    const id = setInterval(() => {
      setSlideIdx((i) => (i + 1) % SLIDES.length)
    }, 5500)
    return () => clearInterval(id)
  }, [])

  async function submitAccess(e: FormEvent) {
    e.preventDefault()
    if (!token.trim() || accessStatus === "loading") return
    setAccessStatus("loading")
    setAccessError("")
    try {
      const res = await fetch("/api/qa-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      })
      if (res.ok) {
        // Cookie is set — reload into the live site.
        window.location.assign("/")
        return
      }
      const data = await res.json().catch(() => ({}))
      setAccessStatus("error")
      setAccessError(data?.message || "That access code isn't right.")
    } catch {
      setAccessStatus("error")
      setAccessError("Something went wrong. Please try again.")
    }
  }

  return (
    <div className="relative min-h-screen font-outfit bg-[var(--color-bg-primary)] flex flex-col overflow-hidden">
      {/* Premium ambient background — layered radial tints + grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_60%_50%_at_85%_15%,rgba(196,154,76,0.12),transparent_60%),radial-gradient(ellipse_70%_60%_at_10%_90%,rgba(94,42,118,0.10),transparent_60%),linear-gradient(180deg,#fbf7f2_0%,#f5efe6_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Top brand bar */}
      <header className="relative z-20 content-container pt-5 small:pt-8 pb-4 small:pb-6 flex items-center justify-between gap-3 border-b border-[var(--color-gold)]/15">
        <Image
          src="/images/df logo - dark.png"
          alt={brandName}
          width={160}
          height={48}
          priority
          className="h-8 xsmall:h-10 small:h-12 w-auto"
        />
        <div className="flex items-center gap-3 xsmall:gap-4">
          <span className="hidden xsmall:block h-3 w-px bg-[var(--color-gold)]/40" />
          <span className="text-[10px] xsmall:text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-gold)] whitespace-nowrap">
            Launching soon
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <section className="relative overflow-hidden w-full">
          <div className="absolute -top-24 -right-16 w-64 h-64 tablet:w-[480px] tablet:h-[480px] rounded-full bg-[var(--color-gold)]/[0.10] blur-3xl pointer-events-none" />
          <div className="absolute -bottom-28 -left-20 w-64 h-64 tablet:w-[480px] tablet:h-[480px] rounded-full bg-[var(--color-plum)]/[0.10] blur-3xl pointer-events-none" />

          <FloatingIcons />

          <div className="content-container relative z-10 py-8 xsmall:py-12 small:py-20">
            <div className="grid grid-cols-1 tablet:grid-cols-2 gap-10 tablet:gap-12 small:gap-16 items-center">
              {/* Left — pitch */}
              <div className="flex flex-col">
                <span className="inline-flex items-center gap-3 text-[11px] xsmall:text-[12px] font-semibold uppercase tracking-[0.28em] text-[var(--color-gold)]">
                  <span className="h-px w-8 bg-[var(--color-gold)]/60" />
                  A new chapter
                </span>

                <h1 className="font-wittgenstein text-[32px] xsmall:text-[44px] tablet:text-[48px] small:text-[64px] font-bold text-[var(--color-plum)] leading-[1.05] mt-4 xsmall:mt-5">
                  Something
                  <br />
                  beautiful is
                  <br />
                  <span className="italic text-[var(--color-gold)]">on the way.</span>
                </h1>

                <p className="text-[14px] small:text-[16px] text-[var(--color-text-secondary)] mt-5 xsmall:mt-6 max-w-md leading-[1.75]">
                  We&apos;re putting the final touches on a fine-jewellery
                  store built around the way you actually wear it — every day,
                  effortlessly. Heirloom craft, honest prices, no compromises.
                </p>

                {/* Ornamental divider */}
                <div className="mt-8 xsmall:mt-10 flex items-center gap-3 max-w-md">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--color-gold)]/40 to-transparent" />
                  <svg width="10" height="10" viewBox="0 0 10 10" className="text-[var(--color-gold)]/70" fill="currentColor" aria-hidden="true">
                    <path d="M5 0 L10 5 L5 10 L0 5 Z" />
                  </svg>
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--color-gold)]/40 to-transparent" />
                </div>

                {/* Promise chips — refined */}
                <ul className="mt-6 xsmall:mt-7 flex flex-wrap gap-2 xsmall:gap-2.5 max-w-md">
                  {PROMISES.map((promise) => (
                    <li
                      key={promise}
                      className="inline-flex items-center px-3.5 xsmall:px-4 h-8 xsmall:h-9 rounded-full bg-white/80 backdrop-blur-sm border border-[var(--color-gold)]/30 text-[10.5px] xsmall:text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-plum)] shadow-[0_1px_0_rgba(196,154,76,0.08)]"
                    >
                      {promise}
                    </li>
                  ))}
                </ul>

                <p className="mt-8 xsmall:mt-10 inline-flex items-center gap-3 text-[10.5px] xsmall:text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                  <span className="h-px w-6 bg-[var(--color-gold)]/40" />
                  Stay tuned · Launching this season
                </p>
              </div>

              {/* Right — hero image slider with fading transitions */}
              <div className="relative">
                {/* Soft ambient glow behind frame */}
                <div className="absolute -inset-6 rounded-[2.25rem] bg-[var(--color-gold)]/[0.10] blur-3xl pointer-events-none" />

                {/* Outer gold hairline frame (luxe double-ring effect) */}
                <div className="relative rounded-[1.4rem] xsmall:rounded-[1.9rem] p-[2px] xsmall:p-[3px] bg-gradient-to-br from-[var(--color-gold)]/50 via-[var(--color-gold)]/15 to-[var(--color-gold)]/50">
                  <div
                    className="relative aspect-[4/3] xsmall:aspect-[5/4] tablet:aspect-[4/3] rounded-2xl xsmall:rounded-3xl overflow-hidden bg-[var(--color-lavender)] shadow-[0_30px_80px_-30px_rgba(60,20,80,0.4)]"
                    aria-roledescription="carousel"
                    aria-label={`${brandName} preview`}
                  >
                    {SLIDES.map((slide, i) => (
                      <div
                        key={slide.src}
                        className="absolute inset-0 transition-opacity duration-[1400ms] ease-in-out"
                        style={{
                          opacity: i === slideIdx ? 1 : 0,
                          transform: i === slideIdx ? "scale(1)" : "scale(1.04)",
                          transition:
                            "opacity 1400ms ease-in-out, transform 6000ms ease-out",
                        }}
                        aria-hidden={i !== slideIdx}
                      >
                        <Image
                          src={slide.src}
                          alt={slide.alt}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          priority={i === 0}
                          className="object-cover"
                        />
                      </div>
                    ))}

                    {/* Bottom gradient for caption legibility */}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none" />

                    {/* Slide counter — top right */}
                    <div className="absolute top-4 xsmall:top-5 right-4 xsmall:right-5 flex items-center gap-2">
                      <span className="text-[10px] xsmall:text-[11px] font-semibold tabular-nums tracking-[0.2em] text-white/90">
                        {String(slideIdx + 1).padStart(2, "0")}
                      </span>
                      <span className="h-px w-6 bg-white/50" />
                      <span className="text-[10px] xsmall:text-[11px] font-semibold tabular-nums tracking-[0.2em] text-white/60">
                        {String(SLIDES.length).padStart(2, "0")}
                      </span>
                    </div>

                    {/* Caption (keyed so it re-fades on slide change) */}
                    <div
                      key={slideIdx}
                      className="absolute bottom-5 xsmall:bottom-7 left-5 xsmall:left-7 right-5 xsmall:right-7 animate-[caption-fade_900ms_ease-out_both]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-px w-8 bg-[var(--color-gold)]" />
                        <p className="text-[10px] xsmall:text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-gold)]">
                          {SLIDES[slideIdx].eyebrow}
                        </p>
                      </div>
                      <p className="font-wittgenstein text-[20px] xsmall:text-[24px] small:text-[28px] font-bold text-white leading-tight mt-2 [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]">
                        {SLIDES[slideIdx].title}
                      </p>

                      {/* Dot indicators — beneath caption */}
                      <div className="flex items-center gap-1.5 mt-4 xsmall:mt-5">
                        {SLIDES.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSlideIdx(i)}
                            aria-label={`Show slide ${i + 1}`}
                            aria-current={i === slideIdx}
                            className={
                              i === slideIdx
                                ? "w-6 h-[3px] rounded-full bg-[var(--color-gold)] transition-all duration-500"
                                : "w-[3px] h-[3px] rounded-full bg-white/40 hover:bg-white/70 transition-all duration-500"
                            }
                          />
                        ))}
                      </div>
                    </div>

                    {/* Corner ornaments — small gold L-shaped accents */}
                    <CornerOrnament position="top-left" />
                    <CornerOrnament position="top-right" />
                    <CornerOrnament position="bottom-left" />
                    <CornerOrnament position="bottom-right" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 content-container pb-6 small:pb-8 pt-5 small:pt-6 border-t border-[var(--color-gold)]/15">
        <div className="flex items-center justify-center gap-3 text-[10.5px] text-[var(--color-text-muted)] tracking-[0.18em] uppercase font-medium">
          <span className="h-px w-6 bg-[var(--color-gold)]/35" />
          <p suppressHydrationWarning>
            © {new Date().getFullYear()} {brandName} · Handcrafted in India
          </p>
          <span className="h-px w-6 bg-[var(--color-gold)]/35" />
        </div>

        {/* Team / QA access — discreet preview entry while coming-soon is on */}
        <div className="mt-4 flex flex-col items-center">
          {!accessOpen ? (
            <button
              type="button"
              onClick={() => setAccessOpen(true)}
              className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)]/70 hover:text-[var(--color-gold)] transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              Team access
            </button>
          ) : (
            <form
              onSubmit={submitAccess}
              className="flex flex-col items-center gap-2 animate-[caption-fade_400ms_ease-out_both]"
            >
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value)
                    if (accessStatus === "error") setAccessStatus("idle")
                  }}
                  placeholder="Access code"
                  autoFocus
                  aria-label="Team access code"
                  className="h-9 w-44 xsmall:w-52 rounded-full border border-[var(--color-gold)]/30 bg-white/80 px-4 text-[12px] text-[var(--color-plum)] placeholder:text-[var(--color-text-muted)]/60 outline-none focus:border-[var(--color-gold)]/70 transition-colors"
                />
                <button
                  type="submit"
                  disabled={accessStatus === "loading"}
                  className="h-9 px-4 rounded-full bg-[var(--color-plum)] text-white text-[11px] font-semibold uppercase tracking-[0.16em] hover:opacity-90 disabled:opacity-60 transition"
                >
                  {accessStatus === "loading" ? "…" : "Enter"}
                </button>
              </div>
              {accessStatus === "error" && (
                <p className="text-[11px] normal-case tracking-normal text-[#b3261e]">
                  {accessError}
                </p>
              )}
            </form>
          )}
        </div>
      </footer>
    </div>
  )
}
