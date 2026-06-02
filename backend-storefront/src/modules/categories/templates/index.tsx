import { notFound } from "next/navigation"

import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import CategoryHero from "@modules/categories/components/category-hero"
import CategoryPageClient from "@modules/categories/components/category-page-client"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"

const PRODUCT_LIMIT = 12

export default async function CategoryTemplate({
  category,
  sortBy,
  countryCode,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  countryCode: string
}) {
  if (!category || !countryCode) notFound()

  const region = await getRegion(countryCode)
  if (!region) notFound()

  const { response } = await listProducts({
    pageParam: 1,
    queryParams: { category_id: [category.id], limit: PRODUCT_LIMIT },
    countryCode,
  })

  return (
    <div data-testid="category-container">
      {/* Hero — full width */}
      <CategoryHero
        name={category.name}
        handle={category.handle}
        description={category.description || undefined}
        productCount={response.count}
      />

      {/* Sub-categories */}
      {category.category_children && category.category_children.length > 0 && (
        <div className="content-container flex flex-wrap gap-2 mb-5 mt-5">
          {category.category_children.map((c) => (
            <LocalizedClientLink
              key={c.id}
              href={`/categories/${c.handle}`}
              className="px-4 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
              }}
            >
              {c.name}
            </LocalizedClientLink>
          ))}
        </div>
      )}

      {/* Filters + Products */}
      <div className="content-container py-4">
        <CategoryPageClient
          initialProducts={response.products}
          initialCount={response.count}
          categoryId={category.id}
          categoryHandle={category.handle}
          countryCode={countryCode}
          limit={PRODUCT_LIMIT}
          region={region}
        />
      </div>
    </div>
  )
}
