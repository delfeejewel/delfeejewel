import Image from "next/image"

import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getProductPrice } from "@lib/util/get-product-price"

const FALLBACK = "/images/fallback-no-image.png"

/**
 * Curated horizontal row of products flagged as staff picks via metadata.
 * Hidden when no products match — caller passes a pre-filtered list.
 */
export default function StaffPicks({
  products,
}: {
  products: HttpTypes.StoreProduct[]
}) {
  if (!products?.length) return null

  return (
    <section className="content-container pt-8 small:pt-10">
      <header className="mb-4">
        <p
          className="text-[0.6875rem] uppercase tracking-[0.18em] font-semibold"
          style={{ color: "var(--color-plum)" }}
        >
          Editor&apos;s picks
        </p>
        <h2
          className="font-wittgenstein text-[1.375rem] small:text-[1.625rem] font-bold mt-0.5"
          style={{ color: "var(--color-text-primary)" }}
        >
          Staff favourites this week
        </h2>
      </header>

      <div className="flex gap-3 small:gap-4 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory">
        {products.slice(0, 10).map((p) => {
          const { cheapestPrice } = getProductPrice({ product: p })
          const img = p.thumbnail || p.images?.[0]?.url || FALLBACK
          return (
            <LocalizedClientLink
              key={p.id}
              href={`/products/${p.handle}`}
              className="group block flex-shrink-0 snap-start w-[180px] small:w-[220px]"
            >
              <div
                className="relative aspect-[3/4] rounded-xl overflow-hidden"
                style={{
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <Image
                  src={img}
                  alt={p.title || "Product"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 220px"
                />
                <span
                  className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[0.625rem] font-semibold"
                  style={{
                    background: "var(--color-plum)",
                    color: "#fff",
                  }}
                >
                  Editor&apos;s pick
                </span>
              </div>
              <p
                className="text-[0.8125rem] small:text-[0.84375rem] font-medium mt-2 line-clamp-2"
                style={{ color: "var(--color-text-primary)" }}
              >
                {p.title}
              </p>
              {cheapestPrice && (
                <p className="mt-0.5 flex items-baseline gap-1.5 tabular-nums">
                  <span
                    className="text-[0.8125rem] font-bold"
                    style={{ color: "var(--color-plum)" }}
                  >
                    {cheapestPrice.calculated_price}
                  </span>
                  {cheapestPrice.price_type === "sale" && (
                    <span
                      className="text-[0.6875rem] line-through"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {cheapestPrice.original_price}
                    </span>
                  )}
                </p>
              )}
            </LocalizedClientLink>
          )
        })}
      </div>
    </section>
  )
}
