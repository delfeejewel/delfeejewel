"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getProductPrice } from "@lib/util/get-product-price"

const FALLBACK = "/images/fallback-no-image.png"
const STORAGE_KEY = "recently_viewed_products"
const MAX_DISPLAY = 8

/**
 * Horizontal strip of products the customer has visited recently. Reads
 * product IDs from localStorage (populated by the PDP) and fetches them
 * via the store SDK. Renders nothing when there's no history.
 */
export default function RecentlyViewed({
  regionId,
}: {
  regionId: string
}) {
  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const ids = raw ? (JSON.parse(raw) as string[]) : []
      if (!ids.length) {
        setLoading(false)
        return
      }
      sdk.client
        .fetch<{ products: HttpTypes.StoreProduct[] }>(
          "/store/products",
          {
            method: "GET",
            query: {
              id: ids.slice(0, MAX_DISPLAY),
              region_id: regionId,
              fields: "id,title,handle,thumbnail,images.url,variants.calculated_price",
            },
          }
        )
        .then(({ products: data }) => {
          if (cancelled) return
          // Preserve the localStorage order (most recent first).
          const byId = new Map(data.map((p) => [p.id, p]))
          const ordered = ids
            .map((id) => byId.get(id))
            .filter(Boolean) as HttpTypes.StoreProduct[]
          setProducts(ordered)
        })
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false))
    } catch {
      setLoading(false)
    }
    return () => {
      cancelled = true
    }
  }, [regionId])

  if (loading || !products.length) return null

  return (
    <section className="content-container pt-8 small:pt-10">
      <header className="mb-4">
        <p
          className="text-[11px] uppercase tracking-[0.18em] font-semibold"
          style={{ color: "var(--color-plum)" }}
        >
          Recently viewed
        </p>
        <h2
          className="font-wittgenstein text-[22px] small:text-[26px] font-bold mt-0.5"
          style={{ color: "var(--color-text-primary)" }}
        >
          Pick up where you left off
        </h2>
      </header>

      <div className="flex gap-3 small:gap-4 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory">
        {products.map((p) => {
          const { cheapestPrice } = getProductPrice({ product: p })
          const img = p.thumbnail || p.images?.[0]?.url || FALLBACK
          return (
            <LocalizedClientLink
              key={p.id}
              href={`/products/${p.handle}`}
              className="group block flex-shrink-0 snap-start w-[150px] small:w-[180px]"
            >
              <div
                className="relative aspect-square rounded-xl overflow-hidden"
                style={{
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <Image
                  src={img}
                  alt={p.title || "Product"}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 40vw, 180px"
                />
              </div>
              <p
                className="text-[12.5px] font-medium mt-2 line-clamp-2"
                style={{ color: "var(--color-text-primary)" }}
              >
                {p.title}
              </p>
              {cheapestPrice && (
                <p
                  className="text-[12.5px] font-bold mt-0.5 tabular-nums"
                  style={{ color: "var(--color-plum)" }}
                >
                  {cheapestPrice.calculated_price}
                </p>
              )}
            </LocalizedClientLink>
          )
        })}
      </div>
    </section>
  )
}
