import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { listCategories } from "@lib/data/categories"

const FALLBACK = "/images/fallback-no-image.png"

/**
 * Top-level category tiles shown above the listing on /store.
 * Server-fetched. Each tile links to /categories/[handle].
 */
export default async function BrowseCategories() {
  let categories = await listCategories({ limit: 50 }).catch(() => [])

  // Top-level only (no parent category). The store API already excludes
  // internal/inactive categories, so no further filtering needed.
  categories = (categories || []).filter((c: any) => !c.parent_category)

  if (!categories.length) return null

  return (
    <section className="content-container pt-8 small:pt-10">
      <header className="flex items-baseline justify-between mb-4">
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.18em] font-semibold"
            style={{ color: "var(--color-plum)" }}
          >
            Browse by category
          </p>
          <h2
            className="font-wittgenstein text-[22px] small:text-[26px] font-bold mt-0.5"
            style={{ color: "var(--color-text-primary)" }}
          >
            Find your shape
          </h2>
        </div>
      </header>

      <div className="grid grid-cols-3 small:grid-cols-6 gap-3 small:gap-4">
        {categories.slice(0, 6).map((c: any) => {
          const cover =
            (c.metadata?.cover_image as string) ||
            c.thumbnail ||
            FALLBACK
          return (
            <LocalizedClientLink
              key={c.id}
              href={`/categories/${c.handle}`}
              className="group block"
            >
              <div
                className="relative aspect-square rounded-xl overflow-hidden"
                style={{
                  background: "var(--color-bg-secondary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <Image
                  src={cover}
                  alt={c.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 33vw, 16vw"
                />
              </div>
              <p
                className="text-[12.5px] small:text-[13.5px] font-medium mt-2 text-center transition-colors"
                style={{ color: "var(--color-text-primary)" }}
              >
                {c.name}
              </p>
            </LocalizedClientLink>
          )
        })}
      </div>
    </section>
  )
}
