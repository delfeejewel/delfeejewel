import { notFound } from "next/navigation"

import { HttpTypes } from "@medusajs/types"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import ListingHero from "@modules/store/components/listing-hero"
import ProductListingClient from "@modules/store/components/product-listing"

const PRODUCT_LIMIT = 48

export default async function CollectionTemplate({
  collection,
  page,
  sortBy,
  countryCode,
}: {
  collection: HttpTypes.StoreCollection
  page?: string
  sortBy?: SortOptions
  countryCode: string
}) {
  if (!collection || !countryCode) notFound()

  const region = await getRegion(countryCode)
  if (!region) notFound()

  const { response } = await listProducts({
    pageParam: 1,
    queryParams: { collection_id: [collection.id], limit: PRODUCT_LIMIT },
    countryCode,
  })

  return (
    <div data-testid="collection-container">
      <ListingHero
        eyebrow="Collection"
        title={collection.title}
        tagline={
          (collection.metadata as any)?.tagline ||
          "A curated edit, hand-picked for you."
        }
        productCount={response.count}
      />

      <div className="content-container py-4">
        <ProductListingClient
          initialProducts={response.products}
          initialCount={response.count}
          region={region}
        />
      </div>
    </div>
  )
}
