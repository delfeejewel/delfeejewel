import Image from "next/image"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { listCategories } from "@lib/data/categories"
import { visibleCategoriesFor } from "@lib/util/category-visibility"

/**
 * Top-level category tiles shown above the listing on /store.
 * Server-fetched. Each tile links to /categories/[handle].
 *
 * Shares the `tiles` visibility surface with the homepage "Shop by Category"
 * grid — same image-led card, so the same admin checkbox governs both, and
 * both require a cover image rather than falling back to a placeholder.
 */
export default async function BrowseCategories() {
  // No cap: a `.slice(0, 6)` here silently drops whatever ranks lowest, the
  // same bug that once hid Coins from the footer. Visibility is admin config,
  // not an arbitrary cut-off.
  // Annotated rather than `.catch(() => [])` inline: the bare `[]` widens the
  // awaited type to a union with never[], which collapses the generic below.
  let all: Awaited<ReturnType<typeof listCategories>> = []
  try {
    all = await listCategories({ limit: 100 })
  } catch {
    all = []
  }
  const categories = visibleCategoriesFor(all, "tiles")

  if (!categories.length) return null

  return (
    <section className="content-container pt-8 small:pt-10">
      <header className="flex items-baseline justify-between mb-4">
        <div>
          <p
            className="text-[0.6875rem] uppercase tracking-[0.18em] font-semibold"
            style={{ color: "var(--color-plum)" }}
          >
            Browse by category
          </p>
          <h2
            className="font-wittgenstein text-[1.375rem] small:text-[1.625rem] font-bold mt-0.5"
            style={{ color: "var(--color-text-primary)" }}
          >
            Find your shape
          </h2>
        </div>
      </header>

      <div className="grid grid-cols-3 small:grid-cols-6 gap-3 small:gap-4">
        {categories.map((c: any) => {
          const cover = c.metadata.cover_image as string
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
                className="text-[0.78125rem] small:text-[0.84375rem] font-medium mt-2 text-center transition-colors"
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
