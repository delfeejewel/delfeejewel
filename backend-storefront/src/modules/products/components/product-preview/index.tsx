import { Text } from "@medusajs/ui"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

export default function ProductPreview({
  product,
  isFeatured,
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  const { cheapestPrice } = getProductPrice({
    product,
  })

  return (
    <LocalizedClientLink href={`/products/${product.handle}`} className="group">
      <div
        data-testid="product-wrapper"
        className="rounded-2xl overflow-hidden transition-all duration-500 ease-out hover:-translate-y-1"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="relative overflow-hidden">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="full"
            isFeatured={isFeatured}
          />
        </div>
        <div className="p-4 flex justify-between items-center">
          <Text
            className="text-sm font-medium transition-colors duration-300"
            style={{ color: "var(--color-text-secondary)" }}
            data-testid="product-title"
          >
            {product.title}
          </Text>
          <div className="flex items-center gap-x-2">
            {cheapestPrice && (
              <div
                className="text-sm font-semibold"
                style={{ color: "var(--color-accent)" }}
              >
                <PreviewPrice price={cheapestPrice} />
              </div>
            )}
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
