const GOLD = "var(--color-gold)"

/**
 * Decorative, slowly-drifting jewellery motifs and soft glows behind legal /
 * policy pages. Purely cosmetic — pointer-events-none, aria-hidden, and
 * disabled under prefers-reduced-motion via the `deco-anim` class.
 */
export default function LegalBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none hidden xsmall:block"
      aria-hidden="true"
    >
      {/* Soft drifting glows */}
      <div
        className="deco-anim absolute -top-28 -left-24 w-[26rem] h-[26rem] rounded-full bg-[var(--color-gold)]/[0.13] blur-[100px]"
        style={{ animation: "deco-glow 23s ease-in-out infinite" }}
      />
      <div
        className="deco-anim absolute top-[40%] -right-28 w-[30rem] h-[30rem] rounded-full bg-[var(--color-plum)]/[0.06] blur-[120px]"
        style={{ animation: "deco-glow 30s ease-in-out -10s infinite reverse" }}
      />
      <div
        className="deco-anim absolute bottom-[4%] left-[16%] w-[22rem] h-[22rem] rounded-full bg-[var(--color-lavender)]/60 blur-[90px]"
        style={{ animation: "deco-glow 26s ease-in-out -6s infinite" }}
      />

      {/* Diamond */}
      <svg
        className="deco-anim absolute top-[9%] left-[6%] w-16 h-16"
        style={{ animation: "deco-drift 26s ease-in-out infinite", opacity: 0.24 }}
        viewBox="0 0 24 24"
        fill="none"
        stroke={GOLD}
        strokeWidth={0.7}
      >
        <path d="M2.5 9h19l-9.5 13L2.5 9zM2.5 9l4-5h11l4 5M7.5 4l4.5 5 4.5-5M12 9v13" />
      </svg>

      {/* Ring */}
      <svg
        className="deco-anim absolute top-[15%] right-[7%] w-20 h-20"
        style={{
          animation: "deco-drift-alt 31s ease-in-out -8s infinite",
          opacity: 0.2,
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke={GOLD}
        strokeWidth={0.55}
      >
        <circle cx="12" cy="14" r="8" />
        <ellipse cx="12" cy="14" rx="4" ry="8" />
        <path d="M8 6.5c1-1.5 2.5-2.5 4-2.5s3 1 4 2.5" />
      </svg>

      {/* Gem */}
      <svg
        className="deco-anim absolute top-[54%] right-[6%] w-16 h-16"
        style={{
          animation: "deco-drift 29s ease-in-out -12s infinite",
          opacity: 0.22,
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke={GOLD}
        strokeWidth={0.65}
      >
        <polygon points="12,2 22,8.5 17,22 7,22 2,8.5" />
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="8.5" x2="22" y2="8.5" />
      </svg>

      {/* Crown */}
      <svg
        className="deco-anim absolute top-[76%] left-[7%] w-16 h-16"
        style={{
          animation: "deco-drift-alt 33s ease-in-out -5s infinite",
          opacity: 0.2,
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke={GOLD}
        strokeWidth={0.65}
      >
        <path d="M2 20h20M4 20l1-12 4 5 3-9 3 9 4-5 1 12" />
      </svg>

      {/* Sparkles (opacity animated by the keyframe) */}
      <svg
        className="deco-anim absolute top-[44%] left-[4%] w-12 h-12"
        style={{ animation: "deco-twinkle 9s ease-in-out infinite" }}
        viewBox="0 0 24 24"
        fill={GOLD}
      >
        <path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z" />
      </svg>
      <svg
        className="deco-anim absolute top-[27%] right-[24%] w-7 h-7"
        style={{ animation: "deco-twinkle 7s ease-in-out -2s infinite" }}
        viewBox="0 0 24 24"
        fill={GOLD}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
      <svg
        className="deco-anim absolute top-[66%] left-[26%] w-5 h-5"
        style={{ animation: "deco-twinkle 6s ease-in-out -4s infinite" }}
        viewBox="0 0 24 24"
        fill={GOLD}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
      <svg
        className="deco-anim absolute top-[87%] right-[22%] w-8 h-8"
        style={{ animation: "deco-twinkle 8s ease-in-out -1s infinite" }}
        viewBox="0 0 24 24"
        fill={GOLD}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
    </div>
  )
}
