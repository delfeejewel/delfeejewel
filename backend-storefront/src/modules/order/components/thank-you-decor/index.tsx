/**
 * Subtle floating jewellery motifs + soft glows drifting in the background of
 * the order-confirmed page. Tuned for the light cream background (reuses the
 * global deco-* keyframes also used by the footer). Purely decorative.
 */
function ThankYouDecor() {
  const gold = "var(--color-gold)"
  const plum = "var(--color-plum)"
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none hidden xsmall:block"
      aria-hidden="true"
    >
      {/* Diamond — top left */}
      <svg
        className="absolute top-24 left-[7%] w-20 h-20 opacity-[0.10]"
        style={{ animation: "deco-drift 27s ease-in-out infinite" }}
        viewBox="0 0 24 24"
        fill="none"
        stroke={plum}
        strokeWidth={0.6}
      >
        <path d="M2.5 9h19l-9.5 13L2.5 9zM2.5 9l4-5h11l4 5M7.5 4l4.5 5 4.5-5M12 9v13" />
      </svg>

      {/* Ring — top right */}
      <svg
        className="absolute top-32 right-[9%] w-24 h-24 opacity-[0.10]"
        style={{ animation: "deco-drift-alt 32s ease-in-out -7s infinite" }}
        viewBox="0 0 24 24"
        fill="none"
        stroke={gold}
        strokeWidth={0.6}
      >
        <circle cx="12" cy="14" r="8" />
        <ellipse cx="12" cy="14" rx="4" ry="8" />
        <path d="M8 6.5c1-1.5 2.5-2.5 4-2.5s3 1 4 2.5" />
      </svg>

      {/* Gem — bottom right */}
      <svg
        className="absolute bottom-28 right-[13%] w-16 h-16 opacity-[0.10]"
        style={{ animation: "deco-drift 25s ease-in-out -11s infinite" }}
        viewBox="0 0 24 24"
        fill="none"
        stroke={plum}
        strokeWidth={0.6}
      >
        <polygon points="12,2 22,8.5 17,22 7,22 2,8.5" />
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="8.5" x2="22" y2="8.5" />
      </svg>

      {/* Sparkle — mid left */}
      <svg
        className="absolute top-[48%] left-[4%] w-12 h-12 opacity-[0.12]"
        style={{ animation: "deco-drift 22s ease-in-out -3s infinite" }}
        viewBox="0 0 24 24"
        fill={gold}
      >
        <path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z" />
      </svg>

      {/* Twinkles */}
      <svg
        className="absolute top-[26%] right-[28%] w-7 h-7 opacity-60"
        style={{ animation: "deco-twinkle 7s ease-in-out infinite" }}
        viewBox="0 0 24 24"
        fill={gold}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
      <svg
        className="absolute bottom-[30%] left-[52%] w-9 h-9 opacity-50"
        style={{ animation: "deco-twinkle 8s ease-in-out -1.5s infinite" }}
        viewBox="0 0 24 24"
        fill={plum}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>

      {/* Soft glows */}
      <div
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[var(--color-gold)]/[0.10] blur-3xl"
        style={{ animation: "deco-glow 24s ease-in-out infinite" }}
      />
      <div
        className="absolute -bottom-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-[var(--color-plum)]/[0.06] blur-3xl"
        style={{ animation: "deco-glow 30s ease-in-out -8s infinite reverse" }}
      />
    </div>
  )
}

export default ThankYouDecor
