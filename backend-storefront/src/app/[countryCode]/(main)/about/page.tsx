import { Metadata } from "next"
import Image from "next/image"
import {
  Gem,
  HandHeart,
  ShieldCheck,
  Leaf,
  Sparkles,
  PenTool,
  Hammer,
  PackageCheck,
  ArrowRight,
  icons as lucideIcons,
  type LucideIcon,
} from "lucide-react"

import DOMPurify from "isomorphic-dompurify"

import { pageMetadata, jsonLd } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import { getBaseURL } from "@lib/util/env"
import { getPage } from "@lib/data/cms"
import PageHero from "@modules/content/components/page-hero"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Props = { params: Promise<{ countryCode: string }> }

// Layout is fixed; only the text/images come from the CMS. Icons are mapped by
// position, so the order of the values/process arrays determines their icon.
const VALUE_ICONS = [HandHeart, ShieldCheck, Leaf, Sparkles]
const PROCESS_ICONS = [PenTool, Hammer, ShieldCheck, PackageCheck]

// The CMS icon picker saves lucide names in kebab-case (e.g. "hand-heart").
// Resolve that to the component, falling back to the position-based default
// when a value has no icon set (or an unknown name).
const toPascalCase = (s: string) =>
  s.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")

function resolveIcon(name: string | undefined, fallback: LucideIcon): LucideIcon {
  if (!name) return fallback
  return (lucideIcons as Record<string, LucideIcon>)[toPascalCase(name)] ?? fallback
}

type AboutContent = {
  hero: { eyebrow: string; title: string; description: string }
  story: { eyebrow: string; title: string; image: string; body: string; quote: string }
  stats: { value: string; label: string }[]
  values: { eyebrow: string; heading: string; items: { title: string; text: string; icon?: string }[] }
  process: { eyebrow: string; heading: string; steps: { title: string; text: string; icon?: string }[] }
  cta: { eyebrow?: string; heading: string; icon?: string; description: string; buttonLabel: string; buttonHref: string; buttonTarget?: string }
  visibility: { hero: boolean; story: boolean; stats: boolean; values: boolean; process: boolean; cta: boolean }
}

// Section keys that can be toggled off in the CMS. A missing flag means visible.
const SECTION_KEYS = ["hero", "story", "stats", "values", "process", "cta"] as const

function resolveVisibility(v: any): AboutContent["visibility"] {
  return SECTION_KEYS.reduce((acc, k) => {
    acc[k] = v?.[k] !== false
    return acc
  }, {} as Record<string, boolean>) as AboutContent["visibility"]
}

// Defaults mirror the original hardcoded page — used when the CMS has no content
// yet, or for any field left blank.
const DEFAULTS: AboutContent = {
  hero: {
    eyebrow: "Our Story",
    title: "Jewellery Made to be Treasured",
    description: `${BRAND.name} is a house of handcrafted fine silver jewellery — where heritage craft meets contemporary design, and every piece is made to be loved for years.`,
  },
  story: {
    eyebrow: "Where it began",
    title: "A love for silver, shaped by hand",
    image: "/images/heritage-artisan.png",
    body:
      `<p>${BRAND.name} began with a simple belief — that fine jewellery should feel personal, honest and built to last. We fell in love with sterling silver for its quiet elegance and its ability to carry a story.</p>` +
      "<p>Today we work hand-in-hand with master artisans across India, blending generations of craft with designs made for modern life. No mass production, no shortcuts — just thoughtfully made pieces you will reach for again and again.</p>",
    quote: "We don't just sell silver — we craft heirlooms in the making.",
  },
  stats: [
    { value: "10K+", label: "Happy Customers" },
    { value: "925", label: "Sterling Silver" },
    { value: "50+", label: "Master Artisans" },
    { value: "Pan-India", label: "Shipping & Returns" },
  ],
  values: {
    eyebrow: "What we stand for",
    heading: "The values behind every piece",
    items: [
      { title: "Handcrafted with Care", text: "Every piece is shaped by skilled Indian artisans, never mass-produced — so each one carries a human touch.", icon: "hand-heart" },
      { title: "Hallmarked Purity", text: "All our silver is 925 sterling and BIS hallmarked, guaranteeing certified purity in every order.", icon: "shield-check" },
      { title: "Responsibly Sourced", text: "We work with trusted suppliers and ethical practices, from raw metal to the final polish.", icon: "leaf" },
      { title: "Made to Last", text: "Timeless designs and durable craftsmanship, backed by easy care guidance and lifetime support.", icon: "sparkles" },
    ],
  },
  process: {
    eyebrow: `The ${BRAND.name} craft`,
    heading: "From sketch to heirloom",
    steps: [
      { title: "Designed", text: "Our designers sketch each collection, balancing modern silhouettes with timeless Indian craft.", icon: "pen-tool" },
      { title: "Handcrafted", text: "Master artisans cast, set and finish every piece by hand in small, careful batches.", icon: "hammer" },
      { title: "Hallmarked", text: "Each piece is checked for purity and BIS hallmarked before it ever leaves the workshop.", icon: "shield-check" },
      { title: "Delivered", text: "Your jewellery arrives in premium packaging, ready to gift or to treasure yourself.", icon: "package-check" },
    ],
  },
  cta: {
    eyebrow: "",
    heading: "Find a piece that feels like you",
    icon: "gem",
    description: "Explore our handcrafted collection of rings, earrings, necklaces and more — each one hallmarked and made to last.",
    buttonLabel: "Shop the Collection",
    buttonHref: "/store",
    buttonTarget: "_self",
  },
  visibility: { hero: true, story: true, stats: true, values: true, process: true, cta: true },
}

// Merge CMS content over defaults so partial/empty content never breaks the page.
function resolveContent(raw: any): AboutContent {
  const c = (typeof raw === "string" ? safeParse(raw) : raw) || {}
  return {
    hero: { ...DEFAULTS.hero, ...(c.hero || {}) },
    story: resolveStory(c.story),
    stats: c.stats?.length ? c.stats : DEFAULTS.stats,
    values: {
      ...DEFAULTS.values,
      ...(c.values || {}),
      items: c.values?.items?.length ? c.values.items : DEFAULTS.values.items,
    },
    process: {
      ...DEFAULTS.process,
      ...(c.process || {}),
      steps: c.process?.steps?.length ? c.process.steps : DEFAULTS.process.steps,
    },
    cta: { ...DEFAULTS.cta, ...(c.cta || {}) },
    visibility: resolveVisibility(c.visibility),
  }
}

function safeParse(s: string) {
  try { return JSON.parse(s) } catch { return {} }
}

// Resolve the Story section, migrating the older { heading, paragraphs[] } shape
// to the current { title, body (HTML) } one so legacy content keeps rendering.
function resolveStory(s: any): AboutContent["story"] {
  const story = s || {}
  const body =
    story.body ||
    (story.paragraphs?.length
      ? story.paragraphs.map((p: string) => `<p>${p}</p>`).join("")
      : DEFAULTS.story.body)
  return {
    eyebrow: story.eyebrow ?? DEFAULTS.story.eyebrow,
    title: story.title ?? story.heading ?? DEFAULTS.story.title,
    image: story.image ?? DEFAULTS.story.image,
    body,
    quote: story.quote ?? DEFAULTS.story.quote,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const page = await getPage("about")
  return pageMetadata({
    countryCode,
    path: "/about",
    title: page?.meta_title || page?.title || "About Us",
    description:
      page?.meta_description ||
      `Discover the story behind ${BRAND.name} — handcrafted 925 sterling silver jewellery, made by Indian artisans and designed to be treasured for generations.`,
  })
}

export default async function AboutPage({ params }: Props) {
  const { countryCode } = await params
  const page = await getPage("about")
  const c = resolveContent(page?.content_json)

  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    url: `${getBaseURL()}/${countryCode}`,
    description: BRAND.description,
    slogan: BRAND.tagline,
  }

  return (
    <div className="bg-[var(--color-bg-primary)] font-outfit">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(orgLd)} />

      {c.visibility.hero && (
        <PageHero
          eyebrow={c.hero.eyebrow}
          title={c.hero.title}
          description={c.hero.description}
          breadcrumb={[{ label: "Home", href: "/" }, { label: "About Us" }]}
        />
      )}

      {/* Story */}
      {c.visibility.story && (
      <section className="page-container py-14 small:py-20">
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-10 small:gap-16 items-center">
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-28 h-28 small:-top-5 small:-left-5 small:w-48 small:h-48 rounded-full bg-[var(--color-lavender-soft)] -z-10" />
            {c.story.image ? (
              <Image
                src={c.story.image}
                alt="An artisan handcrafting silver jewellery"
                width={620}
                height={680}
                className="w-full h-[360px] small:h-[520px] object-cover rounded-2xl border border-[var(--color-border)]"
              />
            ) : (
              <div className="w-full h-[360px] small:h-[520px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]" />
            )}
          </div>
          <div className="flex flex-col gap-5 min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">
              {c.story.eyebrow}
            </span>
            <h2 className="font-wittgenstein text-[26px] small:text-[34px] font-bold leading-tight text-[var(--color-plum)]">
              {c.story.title}
            </h2>
            <div
              className="flex flex-col gap-4 text-[15px] leading-relaxed text-[var(--color-text-secondary)] min-w-0 break-words [&_*]:max-w-full [&_img]:h-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:flex [&_ol]:flex-col [&_ol]:gap-1.5 [&_strong]:font-semibold [&_strong]:text-[var(--color-text-primary)] [&_a]:text-[var(--color-plum)] [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_h2]:font-wittgenstein [&_h2]:text-[20px] [&_h2]:font-bold [&_h2]:text-[var(--color-plum)] [&_h3]:font-semibold [&_h3]:text-[var(--color-plum)]"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.story.body).replace(/&nbsp;|\u00a0/g, " ") }}
            />
            {c.story.quote && (
              <p className="text-[15px] italic text-[var(--color-text-secondary)] border-l-4 border-[var(--color-gold)] pl-5 py-1">
                &ldquo;{c.story.quote}&rdquo;
              </p>
            )}
          </div>
        </div>
      </section>
      )}

      {/* Values */}
      {c.visibility.values && (
      <section className="page-container py-14 small:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10 small:mb-14">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">
            {c.values.eyebrow}
          </span>
          <h2 className="font-wittgenstein text-[26px] small:text-[34px] font-bold text-[var(--color-plum)] mt-2">
            {c.values.heading}
          </h2>
        </div>
        <div className="grid grid-cols-1 xsmall:grid-cols-2 small:grid-cols-4 gap-5">
          {c.values.items.map((v, i) => {
            const Icon = resolveIcon(v.icon, VALUE_ICONS[i % VALUE_ICONS.length])
            return (
              <div
                key={`${v.title}-${i}`}
                className="rounded-2xl bg-white border border-[var(--color-lavender)] p-6 flex flex-col gap-3"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-lavender)] flex items-center justify-center">
                  <Icon size={22} className="text-[var(--color-plum)]" />
                </div>
                <h3 className="font-wittgenstein text-[18px] font-semibold text-[var(--color-plum)]">
                  {v.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                  {v.text}
                </p>
              </div>
            )
          })}
        </div>
      </section>
      )}

      {/* Stats */}
      {c.visibility.stats && (
      <section className="bg-[var(--color-plum)]">
        <div className="page-container py-12 small:py-14">
          <div className="grid grid-cols-2 tablet:grid-cols-4 gap-x-6 gap-y-8">
            {c.stats.map((s, i) => (
              <div key={`${s.label}-${i}`} className="text-center min-w-0">
                <p className="font-wittgenstein text-[24px] xsmall:text-[30px] small:text-[38px] font-bold text-[var(--color-gold)] leading-tight break-words">
                  {s.value}
                </p>
                <p className="text-[11px] xsmall:text-[12px] small:text-[13px] uppercase tracking-[0.12em] text-white/70 mt-1 break-words">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Process */}
      {c.visibility.process && (
      <section className="bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
        <div className="page-container py-14 small:py-20">
          <div className="text-center max-w-2xl mx-auto mb-10 small:mb-14">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">
              {c.process.eyebrow}
            </span>
            <h2 className="font-wittgenstein text-[26px] small:text-[34px] font-bold text-[var(--color-plum)] mt-2">
              {c.process.heading}
            </h2>
          </div>
          <div className="grid grid-cols-1 xsmall:grid-cols-2 small:grid-cols-4 gap-5">
            {c.process.steps.map((p, i) => {
              const Icon = resolveIcon(p.icon, PROCESS_ICONS[i % PROCESS_ICONS.length])
              return (
                <div
                  key={`${p.title}-${i}`}
                  className="relative rounded-2xl bg-white border border-[var(--color-lavender)] p-6"
                >
                  <span className="absolute top-5 right-5 font-wittgenstein text-[40px] font-bold text-[var(--color-lavender)] leading-none">
                    {i + 1}
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-plum)] flex items-center justify-center mb-4">
                    <Icon size={22} className="text-[var(--color-gold)]" />
                  </div>
                  <h3 className="font-wittgenstein text-[18px] font-semibold text-[var(--color-plum)] mb-1.5">
                    {p.title}
                  </h3>
                  <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                    {p.text}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
      )}

      {/* CTA */}
      {c.visibility.cta && (() => {
        const CtaIcon = resolveIcon(c.cta.icon, Gem)
        const ctaTarget = c.cta.buttonTarget === "_blank" ? "_blank" : "_self"
        const ctaRel = ctaTarget === "_blank" ? "noopener noreferrer" : undefined
        const ctaIsExternal = /^https?:\/\//.test(c.cta.buttonHref) || c.cta.buttonHref.startsWith("//")
        const ctaClass =
          "inline-flex items-center justify-center gap-2 max-w-full px-6 small:px-8 py-3.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all"
        return (
          <section className="page-container py-14 small:py-20">
            <div className="relative overflow-hidden rounded-3xl bg-[var(--color-plum)] px-6 small:px-14 py-12 small:py-16 text-center">
              <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-[var(--color-gold)]/10 blur-3xl" />
              {c.cta.eyebrow && (
                <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)] mb-3">
                  {c.cta.eyebrow}
                </span>
              )}
              <CtaIcon size={32} className="text-[var(--color-gold)] mx-auto mb-4" strokeWidth={1.4} />
              <h2 className="font-wittgenstein text-[26px] small:text-[34px] font-bold text-white mb-3">
                {c.cta.heading}
              </h2>
              {c.cta.description && (
                <p className="text-[14px] small:text-[15px] text-white/70 max-w-xl mx-auto mb-7">
                  {c.cta.description}
                </p>
              )}
              {ctaIsExternal ? (
                <a href={c.cta.buttonHref} target={ctaTarget} rel={ctaRel} className={ctaClass}>
                  {c.cta.buttonLabel}
                  <ArrowRight size={15} />
                </a>
              ) : (
                <LocalizedClientLink href={c.cta.buttonHref} target={ctaTarget} rel={ctaRel} className={ctaClass}>
                  {c.cta.buttonLabel}
                  <ArrowRight size={15} />
                </LocalizedClientLink>
              )}
            </div>
          </section>
        )
      })()}
    </div>
  )
}
