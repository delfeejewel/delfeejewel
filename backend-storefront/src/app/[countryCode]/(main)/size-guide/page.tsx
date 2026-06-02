import { Metadata } from "next"
import { Ruler, Circle, Lightbulb, ArrowRight } from "lucide-react"

import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import PageHero from "@modules/content/components/page-hero"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Props = { params: Promise<{ countryCode: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  return pageMetadata({
    countryCode,
    path: "/size-guide",
    title: "Ring Size Guide",
    description: `Find your perfect ring size at home with the ${BRAND.name} size guide — easy measuring methods and an Indian ring size chart.`,
  })
}

const STRING_METHOD = [
  "Wrap a thin strip of paper or string snugly around the base of your finger.",
  "Mark the point where the string overlaps with a pen.",
  "Lay it flat against a ruler and measure the length in millimetres.",
  "Match that circumference to the chart below to find your size.",
]

const RING_METHOD = [
  "Pick a ring that already fits the intended finger well.",
  "Measure the inside diameter across the circle in millimetres.",
  "Match the diameter to the chart below.",
  "If you fall between two sizes, choose the larger one.",
]

const SIZE_CHART = [
  { indian: "6", dia: "14.6", circ: "45.9" },
  { indian: "8", dia: "15.3", circ: "48.0" },
  { indian: "10", dia: "15.9", circ: "50.0" },
  { indian: "12", dia: "16.6", circ: "52.1" },
  { indian: "14", dia: "17.3", circ: "54.4" },
  { indian: "16", dia: "17.9", circ: "56.3" },
  { indian: "18", dia: "18.5", circ: "58.3" },
  { indian: "20", dia: "19.2", circ: "60.3" },
  { indian: "22", dia: "19.8", circ: "62.2" },
  { indian: "24", dia: "20.4", circ: "64.1" },
  { indian: "26", dia: "21.3", circ: "66.9" },
]

const TIPS = [
  "Measure at the end of the day — fingers are slightly larger when warm.",
  "Avoid measuring when your hands are cold, as fingers shrink.",
  "The band should slide on easily but resist coming off over the knuckle.",
  "For wide bands, consider going up by one size for comfort.",
]

export default async function SizeGuidePage({ params }: Props) {
  await params

  return (
    <div className="bg-[var(--color-bg-primary)] font-outfit">
      <PageHero
        eyebrow="Fit Guide"
        title="Find Your Ring Size"
        description="A perfectly sized ring is a joy to wear. Use one of these simple methods to measure accurately from home."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Ring Size Guide" }]}
      />

      {/* Methods */}
      <section className="page-container py-12 small:py-16">
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-5">
          {[
            { icon: Ruler, title: "The String Method", steps: STRING_METHOD },
            {
              icon: Circle,
              title: "Use a Ring You Own",
              steps: RING_METHOD,
            },
          ].map((m) => {
            const Icon = m.icon
            return (
              <div
                key={m.title}
                className="rounded-2xl bg-white border border-[var(--color-lavender)] p-6 small:p-7"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl bg-[var(--color-lavender)] flex items-center justify-center">
                    <Icon size={20} className="text-[var(--color-plum)]" />
                  </div>
                  <h2 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)]">
                    {m.title}
                  </h2>
                </div>
                <ol className="flex flex-col gap-3">
                  {m.steps.map((s, i) => (
                    <li key={s} className="flex gap-3">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-[var(--color-plum)] text-white text-[12px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
                        {s}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}
        </div>
      </section>

      {/* Chart */}
      <section className="bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
        <div className="page-container py-12 small:py-16">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">
              Reference chart
            </span>
            <h2 className="font-wittgenstein text-[26px] small:text-[32px] font-bold text-[var(--color-plum)] mt-2">
              Indian Ring Size Chart
            </h2>
          </div>
          <div className="max-w-2xl mx-auto overflow-hidden rounded-2xl border border-[var(--color-lavender)] bg-white">
            <table className="w-full text-center">
              <thead>
                <tr className="bg-[var(--color-plum)] text-white">
                  <th className="py-3.5 px-4 text-[12px] font-semibold uppercase tracking-[0.08em]">
                    Indian Size
                  </th>
                  <th className="py-3.5 px-4 text-[12px] font-semibold uppercase tracking-[0.08em]">
                    Diameter (mm)
                  </th>
                  <th className="py-3.5 px-4 text-[12px] font-semibold uppercase tracking-[0.08em]">
                    Circumference (mm)
                  </th>
                </tr>
              </thead>
              <tbody>
                {SIZE_CHART.map((row) => (
                  <tr
                    key={row.indian}
                    className="border-t border-[var(--color-lavender)]"
                  >
                    <td className="py-3 px-4 text-[14px] font-semibold text-[var(--color-plum)]">
                      {row.indian}
                    </td>
                    <td className="py-3 px-4 text-[14px] text-[var(--color-text-secondary)]">
                      {row.dia}
                    </td>
                    <td className="py-3 px-4 text-[14px] text-[var(--color-text-secondary)]">
                      {row.circ}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-[12px] text-[var(--color-text-muted)] mt-4">
            Values are approximate. If you're between sizes, we recommend the
            larger one.
          </p>
        </div>
      </section>

      {/* Tips */}
      <section className="page-container py-12 small:py-16">
        <div className="max-w-3xl mx-auto rounded-2xl bg-white border border-[var(--color-lavender)] p-6 small:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-[var(--color-lavender)] flex items-center justify-center">
              <Lightbulb size={20} className="text-[var(--color-plum)]" />
            </div>
            <h2 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)]">
              Tips for an accurate fit
            </h2>
          </div>
          <ul className="grid grid-cols-1 xsmall:grid-cols-2 gap-3">
            {TIPS.map((t) => (
              <li
                key={t}
                className="flex gap-2.5 text-[14px] leading-relaxed text-[var(--color-text-secondary)]"
              >
                <span className="text-[var(--color-gold)] font-bold">•</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="max-w-3xl mx-auto mt-6 text-center">
          <p className="text-[14px] text-[var(--color-text-muted)] mb-4">
            Still unsure about your size? We're happy to help you get it right.
          </p>
          <LocalizedClientLink
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-[var(--color-plum)] text-[var(--color-plum)] text-[12px] font-bold uppercase tracking-wider hover:bg-[var(--color-plum)] hover:text-white transition-all"
          >
            Ask Our Team
            <ArrowRight size={15} />
          </LocalizedClientLink>
        </div>
      </section>
    </div>
  )
}
