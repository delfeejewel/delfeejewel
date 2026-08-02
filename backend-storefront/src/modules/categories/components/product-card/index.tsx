"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { Heart, Eye, Star, ShoppingBag, Check, Loader2 } from "lucide-react"
import { motion, useMotionValue, useTransform } from "framer-motion"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getProductPrice } from "@lib/util/get-product-price"
import { productRating, filledStars } from "@lib/util/product-rating"
import { addWishlistItem, removeWishlistItem } from "@lib/data/wishlist"
import { addToCart } from "@lib/data/cart"
import QuickView from "@modules/products/components/quick-view"
import { useCanHover } from "@lib/hooks/use-can-hover"
import {
  loadWishlistIds,
  isWishlisted as isWishlistedInStore,
  setWishlisted as setWishlistedInStore,
  subscribeWishlist,
} from "@lib/util/wishlist-store"

const FALLBACK = "/images/fallback-no-image.png"

function getBadges(product: HttpTypes.StoreProduct): { label: string; color: string }[] {
  const badges: { label: string; color: string }[] = []
  const meta = product.metadata as any
  if (meta?.collection === "new-arrivals" || meta?.badge === "new") badges.push({ label: "New", color: "#5D2E46" })
  if (meta?.collection === "best-seller" || meta?.badge === "bestseller") badges.push({ label: "Bestseller", color: "#D4AF37" })
  if (meta?.care === "anti-tarnish") badges.push({ label: "Anti-Tarnish", color: "#8b5cf6" })
  if (meta?.metal === "sterling-silver-925") badges.push({ label: "925 Silver", color: "#6b7280" })
  return badges.slice(0, 2)
}

export default function ProductCard({
  product,
  region,
}: {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
}) {
  const [hovered, setHovered] = useState(false)
  const [wishlisted, setWishlisted] = useState(false)
  const [heartPop, setHeartPop] = useState(false)
  const [wishPending, setWishPending] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode?: string }
  // Touch devices fire hover on tap and hold it, which would zoom the photo and
  // slide the quick-action bar up as the shopper heads for the product page.
  const canHover = useCanHover()

  // Reflect the wishlist the customer already has. Shared across every card on
  // the page, so this costs one request per page load rather than one per card.
  useEffect(() => {
    let alive = true
    const sync = () => alive && setWishlisted(isWishlistedInStore(product.id!))
    loadWishlistIds().then(sync)
    const unsub = subscribeWishlist(sync)
    return () => {
      alive = false
      unsub()
    }
  }, [product.id])

  const { cheapestPrice } = getProductPrice({ product })
  const badges = getBadges(product)

  const rating = productRating(product.id)
  const stars = filledStars(rating)

  // Every photo the card can page through: thumbnail first, then the gallery
  // minus that same file and minus videos (a card must never render an mp4).
  const slides = (() => {
    const gallery = (product.images ?? [])
      .map((i) => i?.url)
      .filter(
        (url): url is string =>
          Boolean(url) && !/\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(url)
      )
    const first = product.thumbnail || gallery[0] || FALLBACK
    return [first, ...gallery.filter((url) => url !== first)].slice(0, 5)
  })()

  const [active, setActive] = useState(0)

  const primaryImage = slides[active] ?? FALLBACK
  // Hovering still peeks at the *next* photo, as it always has — with dots that
  // simply means the one after whichever the shopper is currently looking at.
  const secondaryImage = slides[(active + 1) % slides.length] ?? primaryImage
  const hasSecondary = secondaryImage !== primaryImage

  const goTo = (index: number) => (e: React.MouseEvent) => {
    // The whole card is a link; without this a dot click opens the PDP.
    e.preventDefault()
    e.stopPropagation()
    setActive(index)
  }

  // ── Swipe (touch) ──────────────────────────────────────────────────────
  // Dots alone aren't how anyone browses photos on a phone. A horizontal drag
  // across the image steps through the slides; a vertical one is left alone so
  // the page still scrolls normally.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  // A swipe ends in a click on the surrounding link. This suppresses that one
  // click so flicking through photos doesn't open the product page.
  const swiped = useRef(false)

  const SWIPE_MIN_PX = 40

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
    swiped.current = false
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || slides.length < 2) return

    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    // Horizontal intent only — a diagonal drag while scrolling isn't a swipe.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return

    swiped.current = true
    setActive((i) =>
      dx < 0 ? Math.min(i + 1, slides.length - 1) : Math.max(i - 1, 0)
    )
  }

  const suppressClickAfterSwipe = (e: React.MouseEvent) => {
    if (!swiped.current) return
    swiped.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  // 3D tilt effect
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useTransform(mouseY, [-0.5, 0.5], [2, -2])
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-2, 2])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canHover || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5)
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
    setHovered(false)
  }

  /**
   * Save/unsave. This used to flip local state only — the heart turned red and
   * nothing was stored, so a shopper could "save" a dozen pieces and find an
   * empty wishlist later. It now goes through the same API the product page
   * uses, and sends a signed-out shopper to log in rather than pretending.
   */
  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (wishPending) return

    const next = !wishlisted
    setWishlisted(next)
    setWishlistedInStore(product.id!, next)
    setHeartPop(true)
    setTimeout(() => setHeartPop(false), 400)
    setWishPending(true)

    const res = next
      ? await addWishlistItem(product.id!)
      : await removeWishlistItem(product.id!)

    setWishPending(false)

    if (!res.success) {
      // Roll back, then route to login when that's the reason.
      setWishlisted(!next)
      setWishlistedInStore(product.id!, !next)
      if (/sign(ed)? in/i.test(res.error || "")) {
        router.push(`/${countryCode || "in"}/account`)
      }
    }
  }

  /**
   * One-size products go straight into the bag. Anything with options opens
   * Quick View so the shopper picks a size — silently adding "whichever
   * variant is first" is how a ring arrives in the wrong size.
   */
  const handleAddToBag = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const variants = product.variants || []
    if (variants.length !== 1) {
      setQuickOpen(true)
      return
    }
    if (adding || added) return

    setAdding(true)
    try {
      await addToCart({
        variantId: variants[0].id!,
        quantity: 1,
        countryCode: countryCode || "in",
      })
      setAdded(true)
      // The header cart badge is a server component, so it only re-reads the
      // cart on a refresh. Without this the item is in the bag but the icon
      // still shows the old count.
      router.refresh()
      setTimeout(() => setAdded(false), 2000)
    } catch {
      // Fall back to the full page, where the real error is surfaced.
      setQuickOpen(true)
    } finally {
      setAdding(false)
    }
  }

  const openQuickView = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setQuickOpen(true)
  }

  return (
    <>
    <LocalizedClientLink href={`/products/${product.handle}`} className="group block">
      <motion.div
        ref={cardRef}
        className="relative rounded-xl overflow-hidden"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          rotateX,
          rotateY,
          transformPerspective: 1000,
          transition: "box-shadow 0.3s ease",
          boxShadow: hovered ? "0 12px 30px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.03)",
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => canHover && setHovered(true)}
        onMouseLeave={handleMouseLeave}
      >
        {/* Image */}
        <div
          className="relative overflow-hidden"
          // touch-action: pan-y lets the browser keep vertical scrolling while
          // leaving horizontal gestures to the swipe handler.
          style={{ aspectRatio: "3/4", touchAction: "pan-y" }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClickCapture={suppressClickAfterSwipe}
        >
          <Image
            src={primaryImage}
            alt={product.title || "Product"}
            fill
            className="object-cover transition-all duration-700"
            // No zoom on hover — the photo cross-fades to the next one and
            // holds its size, so the framing never shifts under the cursor.
            style={{ opacity: hovered && hasSecondary ? 0 : 1 }}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
          {hasSecondary && (
            <Image
              src={secondaryImage}
              alt={product.title || "Product"}
              fill
              className="object-cover transition-all duration-700"
              style={{ opacity: hovered ? 1 : 0 }}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          )}

          {/* Shimmer overlay on hover */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-500"
            style={{
              opacity: hovered ? 1 : 0,
              background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 55%, transparent 60%)",
              backgroundSize: "200% 100%",
              animation: hovered ? "card-shimmer 1.5s ease-in-out" : "none",
            }}
          />

          {/* Badges */}
          {badges.length > 0 && (
            <motion.div
              className="absolute top-2.5 left-2.5 flex flex-col gap-1.5"
              initial={false}
              animate={{ y: hovered ? 0 : 0, opacity: 1 }}
            >
              {badges.map((badge, i) => (
                <motion.span
                  key={badge.label}
                  className="px-2.5 py-0.5 rounded-full text-[0.625rem] font-semibold text-white shadow-sm"
                  style={{ background: badge.color }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  {badge.label}
                </motion.span>
              ))}
            </motion.div>
          )}

          {/* Wishlist */}
          <motion.button
            className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center z-10"
            style={{
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(6px)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
            animate={{ scale: heartPop ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 0.3 }}
            onClick={handleWishlist}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Heart
              size={15}
              fill={wishlisted ? "#ef4444" : "none"}
              stroke={wishlisted ? "#ef4444" : "#888"}
              strokeWidth={1.5}
            />
          </motion.button>

          {/* Quick actions */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 py-3"
            style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.5))" }}
            initial={false}
            animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 10 }}
            transition={{ duration: 0.25 }}
          >
            <motion.button
              className="px-4 py-2 rounded-full text-[0.6875rem] font-semibold text-white flex items-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.25)" }}
              onClick={openQuickView}
              whileHover={{ scale: 1.05, background: "rgba(255,255,255,0.25)" }}
              whileTap={{ scale: 0.95 }}
              data-testid="card-quick-view"
            >
              <Eye size={13} />
              Quick View
            </motion.button>
            <motion.button
              className="p-2 rounded-full text-white"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.25)" }}
              onClick={handleAddToBag}
              whileHover={{ scale: 1.1, background: "rgba(212,175,55,0.7)" }}
              whileTap={{ scale: 0.9 }}
              aria-label={added ? "Added to bag" : "Add to bag"}
              data-testid="card-add-to-bag"
            >
              {added ? (
                <Check size={13} />
              ) : adding ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ShoppingBag size={13} />
              )}
            </motion.button>
          </motion.div>

          {/* Image dots. Lifted out of the way while the quick-action bar is
              showing, so the two never sit on top of each other. */}
          {slides.length > 1 && (
            <motion.div
              className="absolute inset-x-0 bottom-2 z-20 flex items-center justify-center"
              initial={false}
              animate={{ y: hovered ? -46 : 0 }}
              transition={{ duration: 0.25 }}
              data-testid="card-image-dots"
            >
              {/* A pill behind the dots: product photography runs from white
                  packshots to near-black model shots, and no single dot colour
                  stays legible across both. */}
              <span
                className="flex items-center rounded-full px-1"
                style={{
                  background: "rgba(255,255,255,0.62)",
                  backdropFilter: "blur(6px)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                }}
              >
              {slides.map((_, i) => (
                // Padding rather than size: the dot stays small while the tap
                // target clears the touch minimum.
                <button
                  key={i}
                  type="button"
                  onClick={goTo(i)}
                  aria-label={`Show image ${i + 1} of ${slides.length}`}
                  aria-current={i === active}
                  className="flex items-center justify-center px-1.5 py-2"
                >
                  <span
                    className="block h-1.5 rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: i === active ? 16 : 6,
                      background:
                        i === active
                          ? "var(--color-accent)"
                          : "rgba(0,0,0,0.28)",
                    }}
                  />
                </button>
              ))}
              </span>
            </motion.div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 small:p-4">
          <h3
            className="text-[0.8125rem] small:text-sm font-medium leading-snug mb-1.5 line-clamp-2 transition-colors duration-300"
            style={{ color: hovered ? "var(--color-accent-dark)" : "var(--color-text-primary)" }}
          >
            {product.title}
          </h3>

          <div className="flex items-center gap-1 mb-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={10} fill={i < stars ? "#f59e0b" : "none"} stroke={i < stars ? "#f59e0b" : "#ddd"} strokeWidth={1.5} />
            ))}
            <span className="text-[0.625rem] ml-0.5" style={{ color: "var(--color-text-muted)" }}>({rating.toFixed(1)})</span>
          </div>

          <div className="flex items-center gap-2">
            {cheapestPrice ? (
              <>
                <span className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>
                  {cheapestPrice.calculated_price}
                </span>
                {cheapestPrice.price_type === "sale" && (
                  <span className="text-[0.75rem] line-through" style={{ color: "var(--color-text-muted)" }}>
                    {cheapestPrice.original_price}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Price unavailable</span>
            )}
          </div>
        </div>
      </motion.div>
    </LocalizedClientLink>

    {/* Outside the link on purpose: a dialog nested in an <a> is invalid markup
        and every click inside it would bubble into navigation. */}
    <QuickView
      product={product}
      countryCode={countryCode || "in"}
      open={quickOpen}
      onClose={() => setQuickOpen(false)}
    />
    </>
  )
}
