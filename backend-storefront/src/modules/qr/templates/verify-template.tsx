import Image from "next/image"
import {
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  ArrowRight,
} from "lucide-react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { BRAND } from "@lib/constants.brand"
import type { VerificationResult } from "@lib/data/verify"

const FALLBACK = "/images/fallback-no-image.png"

export default function VerifyTemplate({
  data,
}: {
  data: VerificationResult
}) {
  if (!data.verified) {
    return (
      <div className="bg-[var(--color-bg-primary)] min-h-screen">
        <div className="page-container py-16 small:py-24">
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-red-100 p-8 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-red-500" strokeWidth={1.5} />
            </div>
            <h1 className="font-wittgenstein text-[26px] font-bold text-[var(--color-plum)]">
              Not recognised
            </h1>
            <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed">
              {data.message ||
                "We couldn't verify this code as authentic Delfee. If you bought this from us, please contact our care team and we'll help."}
            </p>
            <LocalizedClientLink
              href="/contact"
              className="mt-2 px-6 py-3 rounded-full bg-[var(--color-plum)] text-white text-[11.5px] font-bold uppercase tracking-wider hover:bg-[var(--color-plum-deep)] transition-all"
            >
              Contact our care team
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    )
  }

  const p = data.product!
  const v = data.variant!
  const meta = p.metadata || {}
  const weight = meta.weight ? `${meta.weight}g` : null

  return (
    <div className="bg-[var(--color-bg-primary)] min-h-screen">
      <div className="page-container py-10 small:py-16">
        {/* Verified hero */}
        <div className="max-w-2xl mx-auto bg-white rounded-3xl overflow-hidden border border-[var(--color-lavender)] shadow-[0_30px_60px_rgba(93,46,70,0.08)]">
          <div className="relative [background:var(--gradient-accent)] py-8 small:py-10 text-center text-[var(--color-plum-deep)]">
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <svg
                className="absolute top-3 left-6 w-10 h-10"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
              </svg>
              <svg
                className="absolute bottom-3 right-6 w-8 h-8"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z" />
              </svg>
            </div>
            <div className="relative flex flex-col items-center gap-2">
              <ShieldCheck size={42} strokeWidth={1.4} />
              <p className="text-[11px] uppercase tracking-[0.25em] font-semibold opacity-80">
                Authenticity Verified
              </p>
              <h1 className="font-wittgenstein text-[32px] small:text-[40px] font-bold leading-tight">
                Verified Genuine
              </h1>
              <p className="text-[12.5px] opacity-70">
                Crafted by {BRAND.name}
              </p>
            </div>
          </div>

          <div className="p-6 small:p-8 flex flex-col gap-6">
            <div className="flex gap-4 items-center">
              <div className="relative w-20 h-20 small:w-24 small:h-24 rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] shrink-0">
                <Image
                  src={p.thumbnail || FALLBACK}
                  alt={p.title}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-semibold mb-1">
                  Authentic piece
                </p>
                <h2 className="font-wittgenstein text-[20px] small:text-[22px] font-bold text-[var(--color-plum)] capitalize leading-tight">
                  {p.title}
                </h2>
                {v.title && v.title !== "Default" && (
                  <p className="text-[13px] text-[var(--color-text-secondary)] mt-0.5">
                    {v.title}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 small:grid-cols-2 gap-x-6 gap-y-3 text-[13px] border-t border-[var(--color-border)] pt-5">
              {p.material && (
                <Detail label="Material" value={p.material} />
              )}
              {weight && <Detail label="Weight" value={weight} />}
              {v.sku && (
                <Detail
                  label="SKU"
                  value={<span className="font-mono">{v.sku}</span>}
                />
              )}
              <Detail
                label="Code"
                value={
                  <span className="font-mono tracking-wider">{data.code}</span>
                }
              />
            </div>

            <LocalizedClientLink
              href={`/products/${p.handle}`}
              className="inline-flex items-center justify-center gap-2 py-3 rounded-full bg-[var(--color-plum)] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[var(--color-plum-deep)] active:scale-[0.98] transition-all"
            >
              View this piece online
              <ArrowRight size={14} />
            </LocalizedClientLink>
          </div>
        </div>

        {/* Trust note */}
        <div className="max-w-2xl mx-auto mt-6 flex items-center justify-center gap-2 text-[12px] text-[var(--color-text-muted)]">
          <Sparkles size={12} className="text-[var(--color-gold)]" />
          Every {BRAND.name} piece carries this code. Always verify before you
          buy from any reseller.
        </div>
      </div>
    </div>
  )
}

function Detail({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-semibold mb-0.5">
        {label}
      </p>
      <p className="text-[var(--color-text-primary)]">{value}</p>
    </div>
  )
}
