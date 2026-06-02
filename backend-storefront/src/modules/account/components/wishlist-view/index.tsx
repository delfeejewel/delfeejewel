"use client"

import { useState } from "react"
import Image from "next/image"
import { Heart, Trash2, ShoppingBag, Share2, Check } from "lucide-react"
import { toast } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getProductPrice } from "@lib/util/get-product-price"
import { addToCart } from "@lib/data/cart"
import { removeWishlistItem } from "@lib/data/wishlist"

const FALLBACK = "/images/fallback-no-image.png"

type Props = {
  products: HttpTypes.StoreProduct[]
  countryCode: string
}

function getBadge(product: HttpTypes.StoreProduct) {
  const meta = (product.metadata || {}) as Record<string, any>
  if (meta.badge === "bestseller" || meta.collection === "best-seller") {
    return {
      label: "Bestseller",
      cls: "bg-[var(--color-gold)]/15 text-[var(--color-gold-dark)]",
    }
  }
  if (meta.badge === "new" || meta.collection === "new-arrivals") {
    return {
      label: "New Arrival",
      cls: "bg-[var(--color-lavender)] text-[var(--color-plum)]",
    }
  }
  return null
}

export default function WishlistView({ products, countryCode }: Props) {
  const [items, setItems] = useState(products)
  const [shared, setShared] = useState(false)

  const handleRemove = async (product: HttpTypes.StoreProduct) => {
    setItems((prev) => prev.filter((p) => p.id !== product.id))

    const res = await removeWishlistItem(product.id)
    if (!res.success) {
      setItems((prev) => [product, ...prev])
      toast.error(res.error || "Could not remove item.")
      return
    }
    toast.success("Removed from wishlist")
  }

  const handleShare = async () => {
    const names = items.map((p) => p.title).filter(Boolean).join(", ")
    const origin =
      typeof window !== "undefined" ? window.location.origin : ""
    const text = names ? `My saved pieces: ${names}` : "My wishlist"

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "My Wishlist", text, url: origin })
        return
      }
      throw new Error("share unsupported")
    } catch {
      try {
        await navigator.clipboard.writeText(`${text} — ${origin}`)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      } catch {
        toast.error("Could not share wishlist.")
      }
    }
  }

  return (
    <div className="w-full" data-testid="wishlist-page-wrapper">
      {/* Header */}
      <header className="flex flex-col tablet:flex-row tablet:justify-between tablet:items-end gap-4 mb-8 tablet:mb-10">
        <div>
          <h1 className="font-wittgenstein text-[28px] tablet:text-[36px] font-bold text-[var(--color-plum)] mb-1.5">
            My Wishlist
          </h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            {items.length === 0
              ? "You haven't saved any pieces yet."
              : `You have ${items.length} item${
                  items.length === 1 ? "" : "s"
                } saved in your collection.`}
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={handleShare}
            className="self-start tablet:self-auto flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--color-border)] bg-white text-[13px] font-semibold text-[var(--color-plum)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            {shared ? <Check size={16} /> : <Share2 size={16} />}
            {shared ? "Link Copied" : "Share Wishlist"}
          </button>
        )}
      </header>

      {/* Content */}
      {items.length === 0 ? (
        <div
          className="bg-white rounded-2xl border border-[var(--color-lavender)] flex flex-col items-center gap-4 py-16 px-6 text-center"
          data-testid="no-wishlist-container"
        >
          <div className="w-14 h-14 rounded-full bg-[var(--color-lavender)] flex items-center justify-center">
            <Heart
              className="w-6 h-6 text-[var(--color-plum)]"
              strokeWidth={1.6}
            />
          </div>
          <h2 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)]">
            Your Wishlist is Empty
          </h2>
          <p className="text-[14px] text-[var(--color-text-muted)] max-w-sm">
            Tap the heart on any piece you love and it will be saved here for
            later.
          </p>
          <LocalizedClientLink
            href="/store"
            className="mt-2 px-6 py-3 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold hover:brightness-105 transition-all"
            data-testid="explore-collection-button"
          >
            Explore the Collection
          </LocalizedClientLink>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 xsmall:grid-cols-2 medium:grid-cols-3 gap-5"
          data-testid="wishlist-grid"
        >
          {items.map((product) => (
            <WishlistCard
              key={product.id}
              product={product}
              countryCode={countryCode}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function WishlistCard({
  product,
  countryCode,
  onRemove,
}: {
  product: HttpTypes.StoreProduct
  countryCode: string
  onRemove: (product: HttpTypes.StoreProduct) => void
}) {
  const [adding, setAdding] = useState(false)

  const { cheapestPrice } = getProductPrice({ product })
  const badge = getBadge(product)
  const image = product.thumbnail || product.images?.[0]?.url || FALLBACK
  const subtitle =
    product.subtitle || product.material || product.collection?.title

  const singleVariant =
    product.variants?.length === 1 ? product.variants[0] : undefined
  const inStock = singleVariant
    ? !singleVariant.manage_inventory ||
      !!singleVariant.allow_backorder ||
      (singleVariant.inventory_quantity ?? 0) > 0
    : true

  const handleAddToBag = async () => {
    if (!singleVariant?.id) return
    setAdding(true)
    try {
      await addToCart({
        variantId: singleVariant.id,
        quantity: 1,
        countryCode,
      })
      toast.success("Added to bag", {
        description: product.title || undefined,
      })
    } catch {
      toast.error("Could not add to bag.")
    } finally {
      setAdding(false)
    }
  }

  return (
    <article
      className="group bg-white rounded-2xl overflow-hidden border border-[var(--color-lavender)] shadow-[0_20px_40px_rgba(93,46,70,0.04)] hover:shadow-[0_25px_50px_rgba(93,46,70,0.08)] transition-all duration-300 flex flex-col"
      data-testid="wishlist-card"
    >
      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--color-bg-secondary)]">
        <LocalizedClientLink href={`/products/${product.handle}`}>
          <Image
            src={image}
            alt={product.title || "Product"}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 512px) 100vw, (max-width: 1280px) 50vw, 25vw"
          />
        </LocalizedClientLink>

        <button
          type="button"
          onClick={() => onRemove(product)}
          aria-label="Remove from wishlist"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
          data-testid="remove-wishlist-item"
        >
          <Trash2 size={16} />
        </button>

        {badge && (
          <span
            className={`absolute bottom-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}
          >
            {badge.label}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-grow">
        <LocalizedClientLink
          href={`/products/${product.handle}`}
          className="block"
        >
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] capitalize leading-snug line-clamp-2 hover:text-[var(--color-plum)] transition-colors">
            {product.title}
          </h3>
        </LocalizedClientLink>
        {subtitle && (
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)] line-clamp-1">
            {subtitle}
          </p>
        )}

        <div className="mt-auto pt-4">
          <div className="flex items-baseline gap-2 mb-3">
            {cheapestPrice ? (
              <>
                <span className="font-wittgenstein text-[20px] font-bold text-[var(--color-plum)]">
                  {cheapestPrice.calculated_price}
                </span>
                {cheapestPrice.price_type === "sale" && (
                  <span className="text-[13px] line-through text-[var(--color-text-muted)]">
                    {cheapestPrice.original_price}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[14px] text-[var(--color-text-muted)]">
                Price unavailable
              </span>
            )}
          </div>

          {singleVariant ? (
            <button
              type="button"
              onClick={handleAddToBag}
              disabled={adding || !inStock}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all"
            >
              <ShoppingBag size={15} />
              {!inStock ? "Out of Stock" : adding ? "Adding..." : "Add to Bag"}
            </button>
          ) : (
            <LocalizedClientLink
              href={`/products/${product.handle}`}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <ShoppingBag size={15} />
              Select Options
            </LocalizedClientLink>
          )}
        </div>
      </div>
    </article>
  )
}
