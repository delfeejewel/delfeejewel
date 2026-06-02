"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Heart, Eye, Star, ShoppingBag } from "lucide-react"
import { motion, useMotionValue, useTransform } from "framer-motion"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getProductPrice } from "@lib/util/get-product-price"

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
  const cardRef = useRef<HTMLDivElement>(null)

  const { cheapestPrice } = getProductPrice({ product })
  const badges = getBadges(product)

  const primaryImage = product.thumbnail || product.images?.[0]?.url || FALLBACK
  const secondaryImage = product.images?.[1]?.url || primaryImage
  const hasSecondary = secondaryImage !== primaryImage

  // 3D tilt effect
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useTransform(mouseY, [-0.5, 0.5], [2, -2])
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-2, 2])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5)
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
    setHovered(false)
  }

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setWishlisted(!wishlisted)
    setHeartPop(true)
    setTimeout(() => setHeartPop(false), 400)
  }

  return (
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
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handleMouseLeave}
      >
        {/* Image */}
        <div className="relative overflow-hidden" style={{ aspectRatio: "3/4" }}>
          <Image
            src={primaryImage}
            alt={product.title || "Product"}
            fill
            className="object-cover transition-all duration-700"
            style={{
              opacity: hovered && hasSecondary ? 0 : 1,
              transform: hovered ? "scale(1.05)" : "scale(1)",
            }}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
          {hasSecondary && (
            <Image
              src={secondaryImage}
              alt={product.title || "Product"}
              fill
              className="object-cover transition-all duration-700"
              style={{ opacity: hovered ? 1 : 0, transform: hovered ? "scale(1)" : "scale(1.05)" }}
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
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-sm"
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
              className="px-4 py-2 rounded-full text-[11px] font-semibold text-white flex items-center gap-1.5"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.25)" }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
              whileHover={{ scale: 1.05, background: "rgba(255,255,255,0.25)" }}
              whileTap={{ scale: 0.95 }}
            >
              <Eye size={13} />
              Quick View
            </motion.button>
            <motion.button
              className="p-2 rounded-full text-white"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.25)" }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
              whileHover={{ scale: 1.1, background: "rgba(212,175,55,0.7)" }}
              whileTap={{ scale: 0.9 }}
            >
              <ShoppingBag size={13} />
            </motion.button>
          </motion.div>
        </div>

        {/* Info */}
        <div className="p-3 small:p-4">
          <h3
            className="text-[13px] small:text-sm font-medium leading-snug mb-1.5 line-clamp-2 transition-colors duration-300"
            style={{ color: hovered ? "var(--color-accent-dark)" : "var(--color-text-primary)" }}
          >
            {product.title}
          </h3>

          <div className="flex items-center gap-1 mb-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={10} fill={i < 4 ? "#f59e0b" : "none"} stroke={i < 4 ? "#f59e0b" : "#ddd"} strokeWidth={1.5} />
            ))}
            <span className="text-[10px] ml-0.5" style={{ color: "var(--color-text-muted)" }}>(4.0)</span>
          </div>

          <div className="flex items-center gap-2">
            {cheapestPrice ? (
              <>
                <span className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>
                  {cheapestPrice.calculated_price}
                </span>
                {cheapestPrice.price_type === "sale" && (
                  <>
                    <span className="text-[12px] line-through" style={{ color: "var(--color-text-muted)" }}>
                      {cheapestPrice.original_price}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                      Sale
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Price unavailable</span>
            )}
          </div>
        </div>
      </motion.div>
    </LocalizedClientLink>
  )
}
