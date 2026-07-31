"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check, Loader2, ShoppingBag } from "lucide-react"
import { HttpTypes } from "@medusajs/types"

import { addToCart } from "@lib/data/cart"
import { getProductPrice } from "@lib/util/get-product-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { FINAL_SALE_CATEGORY_HANDLES } from "@lib/constants"

const FALLBACK = "/images/fallback-no-image.png"

/**
 * Quick View — buy without leaving the listing.
 *
 * Everything shown here comes from the product data the listing already
 * fetched (images, options, variants, prices, stock), so opening it costs no
 * extra request. Deliberately NOT a second product page: no reviews, no
 * delivery check, no coupons. Anything richer belongs on the PDP, which is one
 * click away via "View full details".
 */
export default function QuickView({
  product,
  countryCode,
  open,
  onClose,
}: {
  product: HttpTypes.StoreProduct
  countryCode: string
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState("")

  const options = product.options || []
  const variants = product.variants || []
  const singleVariant = variants.length === 1

  // Reset per open, so a previously chosen size doesn't leak into the next card.
  useEffect(() => {
    if (!open) return
    setSelected({})
    setAdded(false)
    setError("")
  }, [open, product.id])

  // Close on Escape — a modal that traps the shopper is worse than no modal.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const activeVariant = useMemo(() => {
    if (singleVariant) return variants[0]
    if (!options.length) return undefined
    return variants.find((v) =>
      (v.options || []).every(
        (o: any) => selected[o.option_id] === o.value
      ) && (v.options || []).length === options.length
    )
  }, [variants, options, selected, singleVariant])

  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: activeVariant?.id,
  })
  const price = variantPrice || cheapestPrice

  const inStock = (v?: HttpTypes.StoreProductVariant) => {
    if (!v) return false
    if (!(v as any).manage_inventory) return true
    if ((v as any).allow_backorder) return true
    return ((v as any).inventory_quantity ?? 0) > 0
  }

  const isFinalSale = ((product as any).categories || []).some((c: any) =>
    FINAL_SALE_CATEGORY_HANDLES.includes(c?.handle)
  )

  const handleAdd = async () => {
    if (!activeVariant) {
      setError("Please select an option first.")
      return
    }
    if (adding) return
    setAdding(true)
    setError("")
    try {
      await addToCart({
        variantId: activeVariant.id!,
        quantity: 1,
        countryCode,
      })
      setAdded(true)
      // Header cart badge is server-rendered; refresh so the count updates.
      router.refresh()
      setTimeout(() => onClose(), 900)
    } catch (e: any) {
      setError(e?.message || "Could not add this to your bag.")
    } finally {
      setAdding(false)
    }
  }

  const image = product.thumbnail || product.images?.[0]?.url || FALLBACK

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          data-testid="quick-view"
        >
          <motion.div
            className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Quick view: ${product.title}`}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close quick view"
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center bg-white/90 hover:bg-[var(--color-bg-secondary)] transition-colors"
              data-testid="quick-view-close"
            >
              <X size={16} />
            </button>

            <div className="grid grid-cols-1 small:grid-cols-2 gap-0">
              <div className="relative aspect-[3/4] bg-[var(--color-bg-secondary)]">
                <Image
                  src={image}
                  alt={product.title || "Product"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 384px"
                />
              </div>

              <div className="p-6 flex flex-col gap-4">
                <div>
                  <h2 className="font-wittgenstein text-[22px] font-bold leading-tight text-[var(--color-text-primary)]">
                    {product.title}
                  </h2>
                  {product.subtitle && (
                    <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
                      {product.subtitle}
                    </p>
                  )}
                </div>

                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-wittgenstein text-[24px] font-bold text-[var(--color-plum)]">
                    {!activeVariant && !singleVariant && cheapestPrice ? (
                      <>
                        <span className="text-[13px] font-normal text-[var(--color-text-muted)]">
                          From{" "}
                        </span>
                        {cheapestPrice.calculated_price}
                      </>
                    ) : (
                      price?.calculated_price ?? "—"
                    )}
                  </span>
                  {price?.price_type === "sale" && (
                    <span className="text-[13px] line-through text-[var(--color-text-muted)]">
                      {price.original_price}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[var(--color-text-muted)] -mt-3">
                  Inclusive of all taxes
                </span>

                {isFinalSale && (
                  <p className="text-[11.5px] leading-snug rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2 text-[var(--color-text-secondary)]">
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      Final sale.
                    </span>{" "}
                    Not eligible for return, exchange or coupons.
                  </p>
                )}

                {/* Options — only for products that actually have them */}
                {!singleVariant &&
                  options.map((opt) => (
                    <div key={opt.id} className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                        {opt.title}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {(opt.values || []).map((val: any) => {
                          const isOn = selected[opt.id!] === val.value
                          return (
                            <button
                              key={val.id}
                              type="button"
                              onClick={() =>
                                setSelected((s) => ({
                                  ...s,
                                  [opt.id!]: val.value,
                                }))
                              }
                              className={`min-w-[44px] px-3 h-10 rounded-lg border text-[13px] transition-colors ${
                                isOn
                                  ? "border-[var(--color-plum)] bg-[var(--color-plum)] text-white"
                                  : "border-[var(--color-border)] hover:border-[var(--color-plum)]"
                              }`}
                              data-testid="quick-view-option"
                            >
                              {val.value}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                {activeVariant && !inStock(activeVariant) && (
                  <p className="text-[12px] font-medium text-red-500">
                    This option is out of stock.
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={
                    adding || added || (!!activeVariant && !inStock(activeVariant))
                  }
                  className="mt-auto h-12 rounded-lg font-semibold text-[14px] tracking-wide text-[var(--color-plum-deep)] [background:var(--color-gold)] hover:bg-white hover:text-[var(--color-plum)] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  data-testid="quick-view-add"
                >
                  {added ? (
                    <>
                      <Check size={16} /> Added to bag
                    </>
                  ) : adding ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <ShoppingBag size={16} />
                      {activeVariant ? "Add to Bag" : "Select an option"}
                    </>
                  )}
                </button>

                {error && (
                  <p className="text-[12px] text-red-500" role="alert">
                    {error}
                  </p>
                )}

                <LocalizedClientLink
                  href={`/products/${product.handle}`}
                  className="text-center text-[12.5px] font-medium text-[var(--color-plum)] hover:underline underline-offset-2"
                >
                  View full details
                </LocalizedClientLink>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
