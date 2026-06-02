import { Metadata } from "next"
import { Check, X, Sparkles, ShieldCheck, ArrowRight } from "lucide-react"

import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import PageHero from "@modules/content/components/page-hero"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Props = { params: Promise<{ countryCode: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  return pageMetadata({
    countryCode,
    path: "/jewellery-care",
    title: "Jewellery Care Guide",
    description: `Simple tips to keep your ${BRAND.name} sterling silver jewellery bright and beautiful — daily care, cleaning and storage.`,
  })
}

const DOS = [
  "Put your jewellery on last — after makeup, perfume and hairspray.",
  "Remove it before swimming, bathing, sleeping or working out.",
  "Wipe each piece with a soft, dry cloth after wearing.",
  "Store pieces separately to prevent scratches and tangling.",
]

const DONTS = [
  "Expose silver to perfume, lotion, deodorant or hairspray.",
  "Wear it in water — pools, showers and the sea speed up tarnishing.",
  "Use harsh chemicals, toothpaste or abrasive cleaners.",
  "Leave jewellery loose in humid or sunlit places.",
]

const CLEAN_STEPS = [
  {
    title: "Prepare a gentle bath",
    text: "Mix a few drops of mild soap with lukewarm water in a small bowl.",
  },
  {
    title: "Clean softly",
    text: "Dip the piece and clean gently with a soft brush, reaching into detailed areas.",
  },
  {
    title: "Rinse & dry",
    text: "Rinse with clean water and pat completely dry with a soft, lint-free cloth.",
  },
  {
    title: "Polish to finish",
    text: "Restore shine with a dedicated silver polishing cloth, using light strokes.",
  },
]

const STORAGE = [
  "Keep each piece in an airtight pouch or a lined jewellery box.",
  "Add an anti-tarnish strip to slow oxidation.",
  "Store away from direct sunlight, heat and humidity.",
  "Use separate compartments so pieces don't rub together.",
]

export default async function JewelleryCarePage({ params }: Props) {
  await params

  return (
    <div className="bg-[var(--color-bg-primary)] font-outfit">
      <PageHero
        eyebrow="Care Guide"
        title="Caring for Your Silver"
        description="With a little care, sterling silver jewellery stays radiant for years. Here's how to keep every piece looking its best."
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Jewellery Care" },
        ]}
      />

      {/* Why it tarnishes */}
      <section className="page-container py-12 small:py-16">
        <div className="max-w-3xl mx-auto rounded-2xl bg-white border border-[var(--color-lavender)] p-6 small:p-8 flex gap-4 small:gap-5">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-[var(--color-lavender)] flex items-center justify-center">
            <Sparkles size={22} className="text-[var(--color-plum)]" />
          </div>
          <div>
            <h2 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)] mb-1.5">
              Why does silver tarnish?
            </h2>
            <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
              Tarnish is a natural reaction between silver and the air around it
              — not a defect. The good news: it's easily prevented with mindful
              wear and reversed with gentle cleaning. Worn often and stored
              well, your silver stays bright.
            </p>
          </div>
        </div>
      </section>

      {/* Do / Don't */}
      <section className="page-container pb-12 small:pb-16">
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-5">
          <div className="rounded-2xl bg-white border border-[var(--color-lavender)] p-6 small:p-7">
            <h3 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)] mb-4">
              Everyday do's
            </h3>
            <ul className="flex flex-col gap-3">
              {DOS.map((d) => (
                <li key={d} className="flex gap-3">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-green-50 flex items-center justify-center mt-0.5">
                    <Check size={14} className="text-green-600" />
                  </span>
                  <span className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
                    {d}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white border border-[var(--color-lavender)] p-6 small:p-7">
            <h3 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)] mb-4">
              Best to avoid
            </h3>
            <ul className="flex flex-col gap-3">
              {DONTS.map((d) => (
                <li key={d} className="flex gap-3">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-red-50 flex items-center justify-center mt-0.5">
                    <X size={14} className="text-red-500" />
                  </span>
                  <span className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
                    {d}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Cleaning steps */}
      <section className="bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
        <div className="page-container py-12 small:py-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">
              In four simple steps
            </span>
            <h2 className="font-wittgenstein text-[26px] small:text-[32px] font-bold text-[var(--color-plum)] mt-2">
              Cleaning silver at home
            </h2>
          </div>
          <div className="grid grid-cols-1 xsmall:grid-cols-2 medium:grid-cols-4 gap-5">
            {CLEAN_STEPS.map((s, i) => (
              <div
                key={s.title}
                className="relative rounded-2xl bg-white border border-[var(--color-lavender)] p-6"
              >
                <span className="font-wittgenstein text-[32px] font-bold text-[var(--color-gold)] leading-none">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-wittgenstein text-[17px] font-semibold text-[var(--color-plum)] mt-3 mb-1.5">
                  {s.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Storage */}
      <section className="page-container py-12 small:py-16">
        <div className="grid grid-cols-1 tablet:grid-cols-[260px_1fr] gap-8 small:gap-12 items-start">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">
              Keep it lasting
            </span>
            <h2 className="font-wittgenstein text-[26px] small:text-[32px] font-bold text-[var(--color-plum)] mt-2">
              Storing your jewellery
            </h2>
          </div>
          <ul className="grid grid-cols-1 xsmall:grid-cols-2 gap-4">
            {STORAGE.map((s) => (
              <li
                key={s}
                className="flex gap-3 rounded-xl bg-white border border-[var(--color-lavender)] p-4"
              >
                <ShieldCheck
                  size={18}
                  className="text-[var(--color-plum)] shrink-0 mt-0.5"
                />
                <span className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                  {s}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="page-container pb-14 small:pb-20">
        <div className="rounded-3xl bg-[var(--color-plum)] px-8 small:px-14 py-12 text-center">
          <h2 className="font-wittgenstein text-[24px] small:text-[30px] font-bold text-white mb-3">
            Ready to add to your collection?
          </h2>
          <p className="text-[14px] text-white/70 max-w-lg mx-auto mb-6">
            Explore handcrafted sterling silver pieces, made to be worn and
            loved every day.
          </p>
          <LocalizedClientLink
            href="/store"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all"
          >
            Shop the Collection
            <ArrowRight size={15} />
          </LocalizedClientLink>
        </div>
      </section>
    </div>
  )
}
