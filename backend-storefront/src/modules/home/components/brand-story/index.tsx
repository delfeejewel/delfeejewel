import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { BRAND } from "@lib/constants.brand"

export default function BrandStory() {
  return (
    <section className="py-16 small:py-20 overflow-hidden">
      <div className="max-w-[1400px] w-full mx-auto px-6 grid grid-cols-1 tablet:grid-cols-2 gap-10 small:gap-16 items-center">
        {/* Left — Image */}
        <div className="relative">
          <div className="absolute -top-6 -left-6 w-64 h-64 [background:var(--color-lavender-soft)] rounded-full -z-10" />
          <Image
            src="/images/ChatGPT Image May 21, 2026, 11_18_38 AM.png"
            alt="Artisan crafting jewellery"
            width={600}
            height={700}
            className="w-full h-[400px] small:h-[600px] object-cover rounded-2xl shadow-2xl"
          />
        </div>

        {/* Right — Text */}
        <div className="flex flex-col gap-6">
          <span className="font-semibold text-xs tracking-[0.2em] uppercase text-[var(--color-gold)]">
            Our Heritage
          </span>
          <h2 className="font-wittgenstein text-3xl small:text-4xl text-[var(--color-plum)]">
            Crafting Tomorrow&apos;s Heirlooms Today
          </h2>
          <p className="text-base text-[var(--color-text-secondary)] leading-relaxed">
            At {BRAND.name}, we believe that jewellery is more than just an
            ornament; it&apos;s a piece of history, a vessel for memories, and a
            testament to the skill of the human hand. Each piece in our
            collection is born from a collaboration between master artisans and
            visionary designers.
          </p>
          <p className="text-base text-[var(--color-text-secondary)] italic border-l-4 border-[var(--color-gold)] pl-6 py-2">
            &ldquo;We don&apos;t just sell silver; we curate timeless elegance
            that tells your unique story.&rdquo;
          </p>
          <div className="mt-4">
            <LocalizedClientLink
              href="/about"
              className="font-semibold text-[var(--color-plum)] hover:text-[var(--color-gold)] transition-colors flex items-center gap-2 group"
            >
              Discover Our Journey
              <span className="inline-block group-hover:translate-x-1 transition-transform">
                &rarr;
              </span>
            </LocalizedClientLink>
          </div>
        </div>
      </div>
    </section>
  )
}
