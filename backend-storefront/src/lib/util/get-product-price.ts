import { HttpTypes } from "@medusajs/types"
import { getPercentageDiff } from "./get-percentage-diff"
import { convertToLocale } from "./money"

/**
 * Parse an admin-entered compare-at price. Metadata values arrive as strings
 * or numbers depending on how they were written, and anything that isn't a
 * positive finite number is treated as "not set".
 */
const parseCompareAt = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === "") return null
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * The compare-at ("MRP") price an admin set on this variant, falling back to a
 * product-level value. Set in the admin under "Compare-at price (MRP)" and
 * stored in `metadata.mrp`.
 */
export const getCompareAtPrice = (
  variant: any,
  productCompareAt?: number | null
): number | null =>
  parseCompareAt(variant?.metadata?.mrp) ?? productCompareAt ?? null

export const getPricesForVariant = (
  variant: any,
  productCompareAt?: number | null
) => {
  if (!variant?.calculated_price?.calculated_amount) {
    return null
  }

  const { calculated_amount, original_amount, currency_code } =
    variant.calculated_price
  const priceType = variant.calculated_price.calculated_price.price_list_type

  // A genuine Medusa sale (price list) always wins — it's the live, enforced
  // discount. The compare-at price only fills in when there's no sale running
  // and the admin actually set a higher figure than what's being charged.
  const hasPriceListSale = original_amount > calculated_amount
  const compareAt = getCompareAtPrice(variant, productCompareAt)
  const useCompareAt =
    !hasPriceListSale && compareAt !== null && compareAt > calculated_amount

  const originalAmount = useCompareAt ? compareAt : original_amount

  return {
    calculated_price_number: calculated_amount,
    calculated_price: convertToLocale({
      amount: calculated_amount,
      currency_code,
    }),
    original_price_number: originalAmount,
    original_price: convertToLocale({
      amount: originalAmount,
      currency_code,
    }),
    currency_code,
    // Existing UI keys the strikethrough off `price_type === "sale"`, so a
    // compare-at price presents the same way. `is_compare_at` distinguishes
    // the two for anything that needs to tell them apart.
    price_type: useCompareAt ? "sale" : priceType,
    is_compare_at: useCompareAt,
    percentage_diff: getPercentageDiff(originalAmount, calculated_amount),
  }
}

export function getProductPrice({
  product,
  variantId,
}: {
  product: HttpTypes.StoreProduct
  variantId?: string
}) {
  if (!product || !product.id) {
    throw new Error("No product provided")
  }

  // Product-level fallback, so single-price products need the compare-at set
  // once rather than on every variant.
  const productCompareAt = parseCompareAt(
    (product.metadata as Record<string, unknown> | null)?.mrp
  )

  const cheapestPrice = () => {
    if (!product || !product.variants?.length) {
      return null
    }

    const cheapestVariant: any = product.variants
      .filter((v: any) => !!v.calculated_price)
      .sort((a: any, b: any) => {
        return (
          a.calculated_price.calculated_amount -
          b.calculated_price.calculated_amount
        )
      })[0]

    return getPricesForVariant(cheapestVariant, productCompareAt)
  }

  const variantPrice = () => {
    if (!product || !variantId) {
      return null
    }

    const variant: any = product.variants?.find(
      (v) => v.id === variantId || v.sku === variantId
    )

    if (!variant) {
      return null
    }

    return getPricesForVariant(variant, productCompareAt)
  }

  return {
    product,
    cheapestPrice: cheapestPrice(),
    variantPrice: variantPrice(),
  }
}
