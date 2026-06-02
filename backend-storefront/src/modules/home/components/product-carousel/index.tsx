"use client"

import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getProductPrice } from "@lib/util/get-product-price"
import { Heart, ShoppingBag } from "lucide-react"

export default function ProductCarousel({
  products,
  region,
}: {
  products: HttpTypes.StoreProduct[]
  region: HttpTypes.StoreRegion
}) {
  return (
    <section className="[background:var(--color-bg-secondary)] py-16 small:py-20">
      <div className="max-w-[1400px] w-full mx-auto px-6">
        {/* Header */}
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="font-wittgenstein text-2xl small:text-3xl text-[var(--color-plum)] mb-2">
              New Arrivals
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              The latest treasures from our artisans.
            </p>
          </div>
          <LocalizedClientLink
            href="/store"
            className="text-[var(--color-gold)] font-semibold hover:underline"
          >
            View All
          </LocalizedClientLink>
        </div>

        {/* Scroll container */}
        <div className="flex gap-6 overflow-x-auto pb-8 snap-x [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {products.map((product, idx) => {
            const { cheapestPrice } = getProductPrice({ product })
            const thumbnail =
              product.thumbnail || "/images/fallback-no-image.png"
            const metadataBadge = (product.metadata?.badge as string) || null
            const badge = metadataBadge
              ? metadataBadge.toUpperCase()
              : idx < 2
                ? "BESTSELLER"
                : idx === 2
                  ? "NEW"
                  : null

            return (
              <div
                key={product.id}
                className="min-w-[260px] small:min-w-[280px] bg-white rounded-xl p-4 shadow-sm hover:shadow-2xl transition-all duration-500 snap-start flex-shrink-0 group hover:-translate-y-2"
              >
                {/* Image area */}
                <div className="relative rounded-lg overflow-hidden mb-4 aspect-square bg-[var(--color-bg-secondary)]">
                  {badge && (
                    <span
                      className={`absolute top-2 left-2 z-10 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        badge === "BESTSELLER"
                          ? "bg-emerald-100 text-emerald-800"
                          : badge === "NEW"
                            ? "bg-[var(--color-lavender-soft)] text-[var(--color-plum)]"
                            : badge === "TRENDING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                  <LocalizedClientLink href={`/products/${product.handle}`}>
                    <Image
                      src={thumbnail}
                      alt={product.title || ""}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-700"
                      sizes="280px"
                    />
                  </LocalizedClientLink>
                  <button className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-md text-[var(--color-plum)] opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    <Heart className="w-5 h-5" />
                  </button>
                </div>

                {/* Info */}
                <LocalizedClientLink href={`/products/${product.handle}`}>
                  <h3 className="text-base text-[var(--color-text-primary)] mb-1 line-clamp-1">
                    {product.title}
                  </h3>
                </LocalizedClientLink>
                <p className="text-[var(--color-text-muted)] text-sm mb-3">
                  {product.subtitle || product.material || "925 Sterling Silver"}
                </p>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg text-[var(--color-plum)]">
                    {cheapestPrice?.calculated_price || ""}
                  </span>
                  <button className="text-[var(--color-gold)] p-2 rounded-full border border-[var(--color-gold)] hover:[background:var(--color-gold)] hover:text-white transition-all duration-300 active:scale-90">
                    <ShoppingBag className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
