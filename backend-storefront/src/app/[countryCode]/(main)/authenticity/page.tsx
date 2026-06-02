import { Metadata } from "next"
import {
  ShieldCheck,
  Award,
  BadgeCheck,
  Gem,
  ScrollText,
  ArrowRight,
  icons as lucideIcons,
  type LucideIcon,
} from "lucide-react"

import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import { getPage } from "@lib/data/cms"
import PageHero from "@modules/content/components/page-hero"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Props = { params: Promise<{ countryCode: string }> }

// Fallback icons for the pillars/intro/promise when a section has no icon set.
const PILLAR_ICONS = [Gem, ShieldCheck, ScrollText, Award]

// The CMS icon picker saves lucide names in kebab-case (e.g. "shield-check").
const toPascalCase = (s: string) =>
  s.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")

function resolveIcon(name: string | undefined, fallback: LucideIcon): LucideIcon {
  if (!name) return fallback
  return (lucideIcons as Record<string, LucideIcon>)[toPascalCase(name)] ?? fallback
}

type AuthContent = {
  hero: { eyebrow: string; title: string; description: string }
  intro: { icon?: string; heading: string; body: string }
  pillars: { eyebrow: string; heading: string; items: { icon?: string; title: string; text: string }[] }
  marks: { eyebrow: string; heading: string; description: string; items: { title: string; text: string }[] }
  promise: { icon?: string; heading: string; body: string; buttonLabel: string; buttonHref: string; buttonTarget?: string }
  visibility: { hero: boolean; intro: boolean; pillars: boolean; marks: boolean; promise: boolean }
}

const SECTION_KEYS = ["hero", "intro", "pillars", "marks", "promise"] as const

function resolveVisibility(v: any): AuthContent["visibility"] {
  return SECTION_KEYS.reduce((acc, k) => {
    acc[k] = v?.[k] !== false
    return acc
  }, {} as Record<string, boolean>) as AuthContent["visibility"]
}

// Defaults mirror the original hardcoded page — used when the CMS has no content
// yet, or for any field left blank.
const DEFAULTS: AuthContent = {
  hero: {
    eyebrow: "Trust & Purity",
    title: "Authenticity & Hallmarking",
    description:
      "When you buy from us, you buy genuine silver — certified, hallmarked and made to be trusted. Here's our promise on purity.",
  },
  intro: {
    icon: "badge-check",
    heading: 'What does "925" mean?',
    body:
      "Pure silver is too soft for everyday jewellery, so it's combined with a small amount of other metals for durability. " +
      'Sterling silver is 92.5% pure silver — which is why it carries the "925" stamp. ' +
      "It's the trusted global standard for fine silver jewellery you can wear every day.",
  },
  pillars: {
    eyebrow: "Our guarantee",
    heading: "Certified at every step",
    items: [
      { icon: "gem", title: "925 Sterling Silver", text: "Our jewellery is 92.5% pure silver alloyed for strength — the international standard for fine silver." },
      { icon: "shield-check", title: "BIS Hallmarked", text: "Pieces are hallmarked by the Bureau of Indian Standards, independently certifying their purity." },
      { icon: "scroll-text", title: "Certificate of Authenticity", text: "Eligible orders include documentation confirming the metal and craftsmanship of your piece." },
      { icon: "award", title: "Responsibly Sourced", text: "We work with trusted suppliers and ethical practices from raw metal to finished jewellery." },
    ],
  },
  marks: {
    eyebrow: "How to read a hallmark",
    heading: "What to look for",
    description:
      "A genuine BIS hallmark on silver carries a set of tiny stamps. Together, they confirm your jewellery is the real thing.",
    items: [
      { title: "BIS Standard Mark", text: "The official triangular BIS logo — the foundation of a genuine hallmark." },
      { title: "Purity Grade", text: 'The fineness stamp, such as "925", confirming 92.5% silver purity.' },
      { title: "Assaying Centre Mark", text: "Identifies the BIS-recognised centre that tested and certified the piece." },
      { title: "Jeweller's Identification", text: "A unique mark linking the piece back to its responsible jeweller." },
    ],
  },
  promise: {
    icon: "shield-check",
    heading: "Our promise to you",
    body:
      `If any piece you receive from ${BRAND.name} does not meet the purity we promise, we will make it right — ` +
      "with a replacement or a full refund. Genuine silver, every single time.",
    buttonLabel: "Shop Certified Silver",
    buttonHref: "/store",
    buttonTarget: "_self",
  },
  visibility: { hero: true, intro: true, pillars: true, marks: true, promise: true },
}

function safeParse(s: string) {
  try { return JSON.parse(s) } catch { return {} }
}


// Merge CMS content over defaults so partial/empty content never breaks the page.
function resolveContent(raw: any): AuthContent {
  const c = (typeof raw === "string" ? safeParse(raw) : raw) || {}
  return {
    hero: { ...DEFAULTS.hero, ...(c.hero || {}) },
    intro: { ...DEFAULTS.intro, ...(c.intro || {}) },
    pillars: {
      ...DEFAULTS.pillars,
      ...(c.pillars || {}),
      items: c.pillars?.items?.length ? c.pillars.items : DEFAULTS.pillars.items,
    },
    marks: {
      ...DEFAULTS.marks,
      ...(c.marks || {}),
      items: c.marks?.items?.length ? c.marks.items : DEFAULTS.marks.items,
    },
    promise: { ...DEFAULTS.promise, ...(c.promise || {}) },
    visibility: resolveVisibility(c.visibility),
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const page = await getPage("authenticity")
  return pageMetadata({
    countryCode,
    path: "/authenticity",
    title: page?.meta_title || page?.title || "Authenticity & Hallmarking",
    description:
      page?.meta_description ||
      `Every ${BRAND.name} piece is genuine 925 sterling silver and BIS hallmarked. Learn what that means and how we guarantee purity.`,
  })
}

export default async function AuthenticityPage({ params }: Props) {
  await params
  const page = await getPage("authenticity")
  const c = resolveContent(page?.content_json)

  const IntroIcon = resolveIcon(c.intro.icon, BadgeCheck)
  const PromiseIcon = resolveIcon(c.promise.icon, ShieldCheck)
  const promiseTarget = c.promise.buttonTarget === "_blank" ? "_blank" : "_self"
  const promiseRel = promiseTarget === "_blank" ? "noopener noreferrer" : undefined
  const promiseIsExternal = /^https?:\/\//.test(c.promise.buttonHref) || c.promise.buttonHref.startsWith("//")
  const promiseBtnClass =
    "inline-flex items-center justify-center gap-2 max-w-full px-6 small:px-8 py-3.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all"

  return (
    <div className="bg-[var(--color-bg-primary)] font-outfit">
      {c.visibility.hero && (
        <PageHero
          eyebrow={c.hero.eyebrow}
          title={c.hero.title}
          description={c.hero.description}
          breadcrumb={[
            { label: "Home", href: "/" },
            { label: "Authenticity & Hallmarking" },
          ]}
        />
      )}

      {/* Intro — "What 925 means" */}
      {c.visibility.intro && (
        <section className="page-container py-12 small:py-16">
          <div className="max-w-3xl mx-auto rounded-2xl bg-white border border-[var(--color-lavender)] p-6 small:p-8 flex gap-4 small:gap-5">
            <div className="w-12 h-12 shrink-0 rounded-xl bg-[var(--color-lavender)] flex items-center justify-center">
              <IntroIcon size={22} className="text-[var(--color-plum)]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)] mb-1.5">
                {c.intro.heading}
              </h2>
              <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)] min-w-0 break-words whitespace-pre-line">
                {c.intro.body}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Pillars */}
      {c.visibility.pillars && (
        <section className="page-container pb-12 small:pb-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">
              {c.pillars.eyebrow}
            </span>
            <h2 className="font-wittgenstein text-[26px] small:text-[32px] font-bold text-[var(--color-plum)] mt-2">
              {c.pillars.heading}
            </h2>
          </div>
          <div className="grid grid-cols-1 xsmall:grid-cols-2 medium:grid-cols-4 gap-5">
            {c.pillars.items.map((p, i) => {
              const Icon = resolveIcon(p.icon, PILLAR_ICONS[i % PILLAR_ICONS.length])
              return (
                <div
                  key={`${p.title}-${i}`}
                  className="rounded-2xl bg-white border border-[var(--color-lavender)] p-6 flex flex-col gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-plum)] flex items-center justify-center">
                    <Icon size={22} className="text-[var(--color-gold)]" />
                  </div>
                  <h3 className="font-wittgenstein text-[17px] font-semibold text-[var(--color-plum)]">
                    {p.title}
                  </h3>
                  <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                    {p.text}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Hallmark marks */}
      {c.visibility.marks && (
        <section className="bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
          <div className="page-container py-12 small:py-16">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">
                {c.marks.eyebrow}
              </span>
              <h2 className="font-wittgenstein text-[26px] small:text-[32px] font-bold text-[var(--color-plum)] mt-2">
                {c.marks.heading}
              </h2>
              {c.marks.description && (
                <p className="text-[14px] text-[var(--color-text-secondary)] mt-3">
                  {c.marks.description}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 xsmall:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {c.marks.items.map((m, i) => (
                <div
                  key={`${m.title}-${i}`}
                  className="flex gap-4 rounded-2xl bg-white border border-[var(--color-lavender)] p-5"
                >
                  <span className="font-wittgenstein text-[26px] font-bold text-[var(--color-gold)] leading-none">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-wittgenstein text-[16px] font-semibold text-[var(--color-plum)] mb-1">
                      {m.title}
                    </h3>
                    <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                      {m.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Promise + CTA */}
      {c.visibility.promise && (
        <section className="page-container py-12 small:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <PromiseIcon size={32} strokeWidth={1.4} className="text-[var(--color-plum)] mx-auto mb-4" />
            <h2 className="font-wittgenstein text-[24px] small:text-[30px] font-bold text-[var(--color-plum)] mb-3">
              {c.promise.heading}
            </h2>
            <p className="text-[14px] small:text-[15px] leading-relaxed text-[var(--color-text-secondary)] mb-7 break-words whitespace-pre-line">
              {c.promise.body}
            </p>
            {promiseIsExternal ? (
              <a href={c.promise.buttonHref} target={promiseTarget} rel={promiseRel} className={promiseBtnClass}>
                {c.promise.buttonLabel}
                <ArrowRight size={15} />
              </a>
            ) : (
              <LocalizedClientLink href={c.promise.buttonHref} target={promiseTarget} rel={promiseRel} className={promiseBtnClass}>
                {c.promise.buttonLabel}
                <ArrowRight size={15} />
              </LocalizedClientLink>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
