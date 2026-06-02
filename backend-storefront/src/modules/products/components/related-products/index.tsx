import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import Product from "../product-preview"

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

export default async function RelatedProducts({
  product,
  countryCode,
}: RelatedProductsProps) {
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  const queryParams: HttpTypes.StoreProductListParams = {
    is_giftcard: false,
    limit: 4,
  }

  if (region?.id) {
    queryParams.region_id = region.id
  }
  if (product.collection_id) {
    queryParams.collection_id = [product.collection_id]
  }
  if (product.tags?.length) {
    queryParams.tag_id = product.tags
      .map((t) => t.id)
      .filter(Boolean) as string[]
  }

  const products = await listProducts({
    queryParams,
    countryCode,
  }).then(({ response }) =>
    response.products.filter((p) => p.id !== product.id)
  )

  if (!products.length) {
    return null
  }

  return (
    <div>
      {/* Section divider */}
      <div className="page-container">
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-lavender)] to-transparent" />
      </div>

      <div className="page-container py-24">
      {/* Section header */}
      <div className="text-center mb-12">
        <span className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--color-gold)]">
          Curated for you
        </span>
        <h2 className="font-wittgenstein text-[28px] small:text-[32px] font-semibold text-[var(--color-text-primary)] mt-2">
          Complete the Look
        </h2>
      </div>

      {/* Product grid */}
      <ul className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8">
        {products.map((product) => (
          <li key={product.id}>
            <Product region={region} product={product} />
          </li>
        ))}
      </ul>
      </div>

      {/* Section divider */}
      <div className="page-container">
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-lavender)] to-transparent" />
      </div>
    </div>
  )
}
