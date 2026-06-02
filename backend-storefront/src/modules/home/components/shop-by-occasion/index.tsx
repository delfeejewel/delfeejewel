import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const OCCASIONS = [
  { name: "Wedding", slug: "wedding", image: "/images/shop-by-occasion_wedding.png" },
  { name: "Birthday", slug: "birthday", image: "/images/shop-by-occasion_birthday.png" },
  { name: "Anniversary", slug: "anniversary", image: "/images/shop-by-occasion_anniversay.png" },
  { name: "Everyday", slug: "everyday", image: "/images/shop-by-occasion_everyday.png" },
  { name: "Gifting", slug: "gifting", image: "/images/shop-by-occasion_gifting.png" },
  { name: "Festive", slug: "festive", image: "/images/shop-by-occasion_festive.png" },
]

export default function ShopByOccasion() {
  return (
    <section className="py-16 small:py-24">
      <div className="max-w-[1400px] w-full mx-auto px-6">
        {/* Section heading */}
        <div className="text-center mb-12">
          <span className="text-[var(--color-gold)] text-sm font-semibold tracking-wide uppercase">
            Find the Perfect Piece
          </span>
          <h2 className="font-wittgenstein text-2xl small:text-3xl text-[var(--color-plum)] mt-2">
            Shop by Occasion
          </h2>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 xsmall:grid-cols-3 small:grid-cols-6 gap-4 small:gap-6">
          {OCCASIONS.map((occasion) => (
            <LocalizedClientLink
              key={occasion.slug}
              href="/store"
              className="group relative rounded-2xl overflow-hidden aspect-[3/4] cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-500"
            >
              <Image
                src={occasion.image}
                alt={occasion.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-700"
                sizes="(max-width: 512px) 50vw, (max-width: 1024px) 33vw, 16vw"
              />
              {/* Dark gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              {/* Occasion name */}
              <span className="absolute bottom-4 left-0 right-0 text-center text-white font-semibold text-sm small:text-base drop-shadow-md">
                {occasion.name}
              </span>
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  )
}
