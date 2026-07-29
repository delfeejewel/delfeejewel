import { Metadata } from "next"
import Link from "next/link"

import { BRAND } from "@lib/constants.brand"

export const metadata: Metadata = {
  title: `Page Not Found | ${BRAND.name}`,
  description: "The page you're looking for could not be found.",
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 font-outfit"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <div className="text-center flex flex-col items-center max-w-md">
        <span className="text-[12px] font-semibold uppercase tracking-[0.25em] text-[var(--color-gold)]">
          {BRAND.name}
        </span>
        <p className="font-wittgenstein text-[96px] small:text-[128px] font-bold leading-none text-gradient-gold mt-3">
          404
        </p>
        <h1 className="font-wittgenstein text-[26px] small:text-[32px] font-bold text-[var(--color-plum)] mt-2">
          Page Not Found
        </h1>
        <p className="text-[14px] text-[var(--color-text-secondary)] mt-3">
          The page you tried to access does not exist or may have been moved.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}
