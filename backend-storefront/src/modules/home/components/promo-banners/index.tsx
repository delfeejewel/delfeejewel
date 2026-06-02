import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export type PromoBanner = {
  image_url?: string | null
  title: string
  subtitle?: string | null
  cta_label?: string | null
  cta_href?: string | null
}

type Slot = {
  image: string
  title: string
  subtitle?: string
  cta: string
  link: string
}

const DEFAULT_BANNERS: { topLeft: Slot; bottomLeft: Slot; right: Slot } = {
  topLeft: {
    image: "/images/promo-banner_most-gifted.png",
    title: "Most Gifted",
    cta: "Explore now",
    link: "/store",
  },
  bottomLeft: {
    image: "/images/promo-banner_new-arrivals.png",
    title: "New Arrivals",
    subtitle: "Fresh Drops Weekly",
    cta: "Explore now",
    link: "/store",
  },
  right: {
    image: "/images/promo-banner_bestsellers.png",
    title: "Bestsellers",
    subtitle: "most loved silver picks",
    cta: "Shop now",
    link: "/store",
  },
}

function toSlot(b: PromoBanner, fallbackImage: string): Slot {
  return {
    image: b.image_url || fallbackImage,
    title: b.title,
    subtitle: b.subtitle || undefined,
    cta: b.cta_label || "Shop now",
    link: b.cta_href || "/store",
  }
}

export default function PromoBanners({
  banners,
}: {
  banners?: PromoBanner[] | null
}) {
  // The layout needs exactly three cards. Use CMS rows only when at least
  // three are present; otherwise fall back to the curated defaults so the
  // grid never renders half-empty.
  const BANNERS =
    banners && banners.length >= 3
      ? {
          topLeft: toSlot(banners[0], DEFAULT_BANNERS.topLeft.image),
          bottomLeft: toSlot(banners[1], DEFAULT_BANNERS.bottomLeft.image),
          right: toSlot(banners[2], DEFAULT_BANNERS.right.image),
        }
      : DEFAULT_BANNERS

  return (
    <section className="py-10 small:py-16">
      <div className="page-container">
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4 small:gap-5">
          {/* Left column — two stacked banners */}
          <div className="flex flex-col gap-4 small:gap-5">
            {/* Top left */}
            <LocalizedClientLink
              href={BANNERS.topLeft.link}
              className="relative h-[200px] small:h-[240px] rounded-2xl overflow-hidden group"
            >
              <Image
                src={BANNERS.topLeft.image}
                alt={BANNERS.topLeft.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 [background:linear-gradient(135deg,var(--color-plum)/75%,var(--color-plum)/20%)]" />
              <div className="relative h-full flex flex-col justify-center p-8">
                <h3 className="font-wittgenstein text-[28px] small:text-[34px] font-bold text-white leading-[1.1] mb-4">
                  {BANNERS.topLeft.title}
                </h3>
                <span className="inline-block self-start px-5 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-[12px] font-semibold border border-white/30 group-hover:bg-white group-hover:text-[var(--color-plum)] transition-all duration-300">
                  {BANNERS.topLeft.cta}
                </span>
              </div>
            </LocalizedClientLink>

            {/* Bottom left */}
            <LocalizedClientLink
              href={BANNERS.bottomLeft.link}
              className="relative h-[200px] small:h-[240px] rounded-2xl overflow-hidden group"
            >
              <Image
                src={BANNERS.bottomLeft.image}
                alt={BANNERS.bottomLeft.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 [background:linear-gradient(135deg,var(--color-lavender)/80%,var(--color-lavender-soft)/40%)]" />
              <div className="relative h-full flex flex-col justify-center p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-plum)]/60 mb-1">
                  {BANNERS.bottomLeft.subtitle}
                </p>
                <h3 className="font-wittgenstein text-[26px] small:text-[32px] font-bold text-[var(--color-plum)] leading-tight mb-4">
                  {BANNERS.bottomLeft.title}
                </h3>
                <span className="inline-block self-start px-5 py-2 rounded-full bg-[var(--color-plum)]/10 text-[var(--color-plum)] text-[12px] font-semibold border border-[var(--color-plum)]/20 group-hover:bg-[var(--color-plum)] group-hover:text-white transition-all duration-300">
                  {BANNERS.bottomLeft.cta}
                </span>
              </div>
            </LocalizedClientLink>
          </div>

          {/* Right column — one tall banner */}
          <LocalizedClientLink
            href={BANNERS.right.link}
            className="relative h-[416px] tablet:h-full rounded-2xl overflow-hidden group"
          >
            <Image
              src={BANNERS.right.image}
              alt={BANNERS.right.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 [background:linear-gradient(to_top,var(--color-plum-deep)/60%,transparent_60%)]" />
            <div className="relative h-full flex flex-col justify-end p-8 small:p-10">
              <h3 className="font-wittgenstein text-[36px] small:text-[44px] font-bold text-white leading-[1.1] mb-2">
                {BANNERS.right.title}
              </h3>
              <p className="text-white/70 text-[14px] small:text-[16px] mb-6">
                {BANNERS.right.subtitle}
              </p>
              <span className="inline-block self-start px-6 py-2.5 rounded-full [background:var(--color-gold)] text-[var(--color-plum-deep)] text-[13px] font-semibold group-hover:bg-white transition-all duration-300 shadow-lg">
                {BANNERS.right.cta}
              </span>
            </div>
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}
