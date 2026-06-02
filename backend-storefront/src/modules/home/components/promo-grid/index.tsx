import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function PromoGrid() {
  return (
    <section className="py-16 small:py-20">
      <div className="max-w-[1400px] w-full mx-auto px-6">
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-6">
          {/* Left promo — plum gradient */}
          <div className="relative h-[350px] small:h-[400px] rounded-3xl overflow-hidden group shadow-lg">
            <Image
              src="/images/promo-grid_personalized_gifts.png"
              alt="Personalized Gifts"
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-1000"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 [background:linear-gradient(to_top,var(--color-plum-deep)/90%,var(--color-plum-deep)/20%,transparent)] p-8 small:p-10 flex flex-col justify-end">
              <h3 className="font-wittgenstein text-2xl small:text-3xl text-white mb-2">
                Personalized Gifts
              </h3>
              <p className="text-white/80 mb-6 max-w-xs">
                Make it uniquely theirs with custom engravings and special
                messages.
              </p>
              <LocalizedClientLink
                href="/store"
                className="bg-white text-[var(--color-plum-deep)] self-start px-8 py-3 rounded-full font-semibold hover:[background:var(--color-gold)] hover:text-white transition-colors duration-300"
              >
                Explore More
              </LocalizedClientLink>
            </div>
          </div>

          {/* Right promo — gold gradient */}
          <div className="relative h-[350px] small:h-[400px] rounded-3xl overflow-hidden group shadow-lg">
            <Image
              src="/images/promo-grid_daily-wear-silver.png"
              alt="Daily Wear Silver"
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-1000"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 [background:linear-gradient(to_top,var(--color-gold)/90%,var(--color-gold)/20%,transparent)] p-8 small:p-10 flex flex-col justify-end">
              <h3 className="font-wittgenstein text-2xl small:text-3xl text-[var(--color-plum-deep)] mb-2">
                Daily Wear Silver
              </h3>
              <p className="text-[var(--color-plum-deep)]/80 mb-6 max-w-xs">
                Chic, lightweight pieces designed for your everyday effortless
                elegance.
              </p>
              <LocalizedClientLink
                href="/store"
                className="[background:var(--color-plum-deep)] text-white self-start px-8 py-3 rounded-full font-semibold hover:bg-white hover:text-[var(--color-plum-deep)] transition-colors duration-300"
              >
                Shop Daily Wear
              </LocalizedClientLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
