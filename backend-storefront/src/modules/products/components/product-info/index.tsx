"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { HttpTypes } from "@medusajs/types"
import { useParams, usePathname, useSearchParams, useRouter } from "next/navigation"
import { isEqual } from "lodash"
import { motion, useInView } from "framer-motion"
import { addToCart } from "@lib/data/cart"
import { addWishlistItem, removeWishlistItem } from "@lib/data/wishlist"
import { getProductPrice } from "@lib/util/get-product-price"
import {
  Heart, Award, Truck, ShieldCheck, CheckCircle, Star,
  Clock, Gift, RefreshCw, Package, Share2, Minus, Plus, X,
} from "lucide-react"
import { AnimatePresence } from "framer-motion"

type Props = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  isLoggedIn: boolean
  initialWishlisted: boolean
}

const optionsAsKeymap = (opts: HttpTypes.StoreProductVariant["options"]) =>
  opts?.reduce((acc: Record<string, string>, o: any) => { acc[o.option_id] = o.value; return acc }, {})

const COLOR_MAP: Record<string, string> = {
  silver: "#E5E4E2", gold: "#D4AF37", "rose gold": "#B76E79",
  "sterling-silver-925": "#E5E4E2", "pure-silver-999": "#C0C0C0",
  "oxidized-silver": "#6B6B6B", red: "#C41E3A", blue: "#2E5090", green: "#2E8B57",
  white: "#F5F5F5", black: "#2d2d2d", pink: "#E8A0BF",
}

export default function ProductInfo({
  product,
  region,
  isLoggedIn,
  initialWishlisted,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const countryCode = useParams().countryCode as string
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [isBuying, setIsBuying] = useState(false)
  const [wishlisted, setWishlisted] = useState(initialWishlisted)
  const [wishlistPending, setWishlistPending] = useState(false)
  const [wishlistAuthOpen, setWishlistAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "signup">("login")
  const [authForm, setAuthForm] = useState({ email: "", password: "", first_name: "", last_name: "", phone: "" })
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [pincode, setPincode] = useState("")
  const [deliveryResult, setDeliveryResult] = useState<"available" | "unavailable" | "invalid" | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [giftWrap, setGiftWrap] = useState(false)

  useEffect(() => {
    if (product.variants?.length === 1) {
      setOptions(optionsAsKeymap(product.variants[0].options) ?? {})
    }
  }, [product.variants])

  const selectedVariant = useMemo(() => {
    if (!product.variants?.length) return
    return product.variants.find((v) => isEqual(optionsAsKeymap(v.options), options))
  }, [product.variants, options])

  const isValidVariant = useMemo(() =>
    product.variants?.some((v) => isEqual(optionsAsKeymap(v.options), options)),
  [product.variants, options])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const val = isValidVariant ? selectedVariant?.id : null
    if (params.get("v_id") === val) return
    if (val) params.set("v_id", val)
    else params.delete("v_id")
    router.replace(pathname + "?" + params.toString())
  }, [selectedVariant, isValidVariant])

  const inStock = useMemo(() => {
    if (selectedVariant && !selectedVariant.manage_inventory) return true
    if (selectedVariant?.allow_backorder) return true
    if (selectedVariant?.manage_inventory && (selectedVariant?.inventory_quantity || 0) > 0) return true
    return false
  }, [selectedVariant])

  const { cheapestPrice, variantPrice } = getProductPrice({ product, variantId: selectedVariant?.id })
  const price = variantPrice || cheapestPrice
  const collection = product.collection
  const stockQty = selectedVariant?.inventory_quantity || 0
  const lowStock = selectedVariant?.manage_inventory && stockQty > 0 && stockQty <= 5

  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return
    setIsAdding(true)
    await addToCart({ variantId: selectedVariant.id, quantity, countryCode })
    setIsAdding(false)
  }

  const handleBuyNow = () => {
    if (!selectedVariant?.id) return
    setIsBuying(true)
    addToCart({ variantId: selectedVariant.id, quantity, countryCode })
    setTimeout(() => router.push(`/${countryCode}/checkout`), 400)
  }

  const handleWishlistToggle = async () => {
    if (!isLoggedIn) {
      setWishlistAuthOpen(true)
      return
    }
    if (wishlistPending) return

    const next = !wishlisted
    setWishlisted(next)
    setWishlistPending(true)

    const res = next
      ? await addWishlistItem(product.id)
      : await removeWishlistItem(product.id)

    setWishlistPending(false)
    if (!res.success) {
      setWishlisted(!next)
    }
  }

  const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
  const API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

  const handleAuth = async () => {
    if (!authForm.email || !authForm.password) { setAuthError("Email and password required"); return }
    if (authMode === "signup" && (!authForm.first_name || !authForm.last_name)) { setAuthError("Name is required"); return }
    if (authMode === "signup" && authForm.password.length < 6) { setAuthError("Password must be at least 6 characters"); return }

    setAuthLoading(true)
    try {
      if (authMode === "login") {
        const res = await fetch(`${BACKEND}/auth/customer/emailpass`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authForm.email, password: authForm.password }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || "Invalid credentials")
        document.cookie = `_medusa_jwt=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}`
      } else {
        const regRes = await fetch(`${BACKEND}/auth/customer/emailpass/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authForm.email, password: authForm.password }),
        })
        const regData = await regRes.json()
        if (!regRes.ok) throw new Error(regData.message || "Registration failed")

        await fetch(`${BACKEND}/store/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${regData.token}`, "x-publishable-api-key": API_KEY },
          body: JSON.stringify({ email: authForm.email, first_name: authForm.first_name, last_name: authForm.last_name, phone: authForm.phone || undefined }),
        })

        const loginRes = await fetch(`${BACKEND}/auth/customer/emailpass`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authForm.email, password: authForm.password }),
        })
        const loginData = await loginRes.json()
        if (loginRes.ok) document.cookie = `_medusa_jwt=${loginData.token}; path=/; max-age=${60 * 60 * 24 * 7}`
      }
      setWishlistAuthOpen(false)
      window.location.reload()
    } catch (e: any) {
      setAuthError(e.message || "Something went wrong")
    } finally {
      setAuthLoading(false)
    }
  }

  // Read the share URL after mount so SSR and hydration agree on initial markup
  // (window.location.href is browser-only and would otherwise cause a mismatch
  // on the QR code src + share anchor hrefs).
  const [shareUrl, setShareUrl] = useState("")
  useEffect(() => {
    setShareUrl(window.location.href)
  }, [])
  const shareText = `Check out ${product.title} from Delfee`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      const input = document.createElement("input")
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      ref={ref}
      className="flex flex-col"
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.15 }}
    >
      {/* Top row — collection label + actions (mobile only, desktop in sticky column) */}
      <div className="flex items-start justify-between mb-3">
        <div>
          {collection && (
            <span className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--color-plum)]">
              {collection.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Gift badge with tooltip */}
          <div className="relative group/gift">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-gold)]/[0.08] text-[10px] font-semibold text-[var(--color-gold)] tracking-[0.03em] cursor-default">
              <Gift size={12} /> Gift Ready
            </span>
            <div className="absolute top-full right-0 mt-2 w-56 px-3 py-2.5 rounded-lg bg-[var(--color-plum)] text-white text-[11px] leading-[1.5] shadow-lg opacity-0 invisible group-hover/gift:opacity-100 group-hover/gift:visible transition-all duration-200 z-20 pointer-events-none">
              This product is gift ready and will be delivered in a premium velvet box.
              <div className="absolute -top-1 right-6 w-2 h-2 bg-[var(--color-plum)] rotate-45" />
            </div>
          </div>
          {/* Share icon */}
          <button
            onClick={() => setShareOpen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors"
            title="Share"
          >
            <Share2 size={16} className="text-[var(--color-text-muted)] hover:text-[var(--color-plum)]" />
          </button>
        </div>
      </div>

      {/* Title */}
      <h1 className="font-wittgenstein text-[24px] small:text-[30px] medium:text-[36px] font-bold leading-tight text-[var(--color-text-primary)] mb-3 capitalize">
        {product.title}
      </h1>

      {/* Rating — clickable, scrolls to reviews */}
      <button
        onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className="flex items-center gap-3 mb-5 group cursor-pointer"
      >
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} size={14} fill={s <= 4 ? "var(--color-gold)" : "none"} stroke={s <= 4 ? "var(--color-gold)" : "var(--color-border)"} strokeWidth={1.5} />
          ))}
        </div>
        <span className="text-[12px] text-[var(--color-text-muted)] group-hover:text-[var(--color-plum)] group-hover:underline underline-offset-2 transition-colors">
          4.8 (128 reviews)
        </span>
      </button>

      {/* Price + stock */}
      <div className="flex items-baseline gap-4 mb-1">
        {price ? (
          <>
            {price.price_type === "sale" && (
              <span className="text-[16px] line-through text-[var(--color-text-muted)]">
                {price.original_price}
              </span>
            )}
            <span className="font-wittgenstein text-[26px] small:text-[28px] font-bold text-[var(--color-plum)]">
              {!selectedVariant && cheapestPrice ? <><span className="text-[14px] font-normal text-[var(--color-text-muted)]">From </span>{cheapestPrice.calculated_price}</> : price.calculated_price}
            </span>
            {price.price_type === "sale" && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-green-50 text-green-700">
                Save {price.percentage_diff}%
              </span>
            )}
          </>
        ) : (
          <span className="text-lg text-[var(--color-text-muted)]">Price unavailable</span>
        )}
      </div>

      {/* Tax + stock */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-[11px] text-[var(--color-text-muted)]">Inclusive of all taxes</span>
        {selectedVariant && inStock && (
          <span className="text-[11px] font-semibold tracking-[0.05em] flex items-center gap-1 text-green-600">
            <CheckCircle size={12} /> In Stock
          </span>
        )}
      </div>

      {/* Low stock urgency */}
      {lowStock && (
        <div className="flex items-center gap-2 mb-5 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <Clock size={14} className="text-amber-600" />
          <span className="text-[12px] font-semibold text-amber-700">
            Only {stockQty} left — order soon
          </span>
        </div>
      )}

      <div className="h-px bg-[var(--color-lavender)] mb-6" />

      {/* Variant options */}
      <div className="space-y-7">
        {(product.variants?.length ?? 0) > 1 &&
          (product.options || []).map((option) => {
            const isColor = /color|metal|finish/i.test(option.title || "")

            return (
              <div key={option.id}>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-semibold tracking-[0.1em] uppercase text-[var(--color-text-secondary)]">
                    {option.title}
                    {options[option.id] && (
                      <span className="ml-2 normal-case tracking-normal font-normal text-[var(--color-text-primary)]">
                        — {options[option.id]}
                      </span>
                    )}
                  </label>
                </div>

                {isColor ? (
                  <div className="flex gap-4">
                    {option.values?.map((val: any) => {
                      const isSelected = options[option.id] === val.value
                      const bg = COLOR_MAP[val.value.toLowerCase()] || "#ccc"
                      return (
                        <button
                          key={val.id}
                          onClick={() => setOptions((p) => ({ ...p, [option.id]: val.value }))}
                          className={`w-11 h-11 rounded-full shadow-inner transition-all duration-200 ${
                            isSelected ? "ring-2 ring-[var(--color-gold)] ring-offset-2" : "hover:ring-2 hover:ring-[var(--color-lavender)]"
                          }`}
                          style={{ background: bg }}
                          title={val.value}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {option.values?.map((val: any) => {
                      const isSelected = options[option.id] === val.value
                      return (
                        <button
                          key={val.id}
                          onClick={() => setOptions((p) => ({ ...p, [option.id]: val.value }))}
                          className={`px-6 py-2.5 rounded-lg text-sm font-semibold tracking-[0.03em] transition-all duration-200 ${
                            isSelected
                              ? "border border-[var(--color-plum-deep)] text-[var(--color-plum-deep)] bg-white shadow-sm"
                              : "border border-[var(--color-lavender)] text-[var(--color-text-secondary)] hover:border-[var(--color-plum-deep)]"
                          }`}
                        >
                          {val.value}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

        {/* Delivery checker */}
        <div className="rounded-lg bg-[var(--color-bg-secondary)] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-[var(--color-gold)] shrink-0" />
            <span className="text-xs font-semibold tracking-[0.06em] uppercase text-[var(--color-text-primary)]">
              Check Delivery
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={pincode}
              onChange={(e) => { setPincode(e.target.value.replace(/\D/g, "").slice(0, 6)); setDeliveryResult(null) }}
              placeholder="Enter 6-digit pincode"
              maxLength={6}
              className="flex-1 h-10 px-3 rounded-lg text-[13px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter" && pincode.length === 6) {
                  setDeliveryResult("available")
                }
              }}
            />
            <button
              onClick={() => {
                if (pincode.length !== 6) { setDeliveryResult("invalid"); return }
                setDeliveryResult("available")
              }}
              className="px-5 h-10 rounded-lg text-xs font-semibold tracking-[0.05em] uppercase text-white bg-[var(--color-plum)] hover:bg-[var(--color-plum-deep)] transition-colors"
            >
              Check
            </button>
          </div>

          {deliveryResult === "available" && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[12px] flex items-center gap-1.5 text-green-600 font-medium">
                <CheckCircle size={13} /> Delivery available to {pincode}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] pl-5">Standard: 3–5 business days</p>
              <p className="text-[11px] text-[var(--color-text-muted)] pl-5">Cash on Delivery available</p>
              <p className="text-[11px] text-[var(--color-text-muted)] pl-5">Free shipping on orders above ₹999</p>
            </div>
          )}
          {deliveryResult === "invalid" && (
            <p className="text-[12px] text-red-500 pt-1">Please enter a valid 6-digit pincode</p>
          )}
        </div>

        {/* Gift wrap option */}
        <label className="flex items-center gap-3 py-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={giftWrap}
            onChange={(e) => setGiftWrap(e.target.checked)}
            className="w-5 h-5 rounded border-2 border-[var(--color-lavender)] text-[var(--color-plum)] focus:ring-[var(--color-plum)]/20 focus:ring-offset-0 cursor-pointer accent-[var(--color-plum)]"
          />
          <span className="text-[14px] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
            Is this a <span className="font-semibold text-[var(--color-plum)]">Gift</span>? 🎁 Wrap it for just (<span className="font-semibold">₹50</span>)
          </span>
        </label>

        {/* Quantity + Add to Cart + Wishlist — all on one line */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center gap-3">
            {/* Quantity */}
            <div className="flex items-center h-12 rounded-lg border border-[var(--color-lavender)] shrink-0">
              <button
                className="w-10 h-full flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors rounded-l-lg"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={14} className="text-[var(--color-text-secondary)]" />
              </button>
              <span className="w-9 text-center text-[14px] font-semibold text-[var(--color-text-primary)]">{quantity}</span>
              <button
                className="w-10 h-full flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors rounded-r-lg"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus size={14} className="text-[var(--color-text-secondary)]" />
              </button>
            </div>

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              disabled={!inStock || !selectedVariant || isAdding || !isValidVariant}
              className="pdp-v1-cta flex-1 h-12 rounded-lg text-sm font-semibold tracking-[0.06em] uppercase text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
            >
              {isAdding ? "Adding..." : !selectedVariant ? "Select Options" : !inStock ? "Out of Stock" : "Add to Shopping Bag"}
            </button>

            {/* Wishlist */}
            <button
              onClick={handleWishlistToggle}
              disabled={wishlistPending}
              aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
              className="w-12 h-12 shrink-0 border border-[var(--color-lavender)] rounded-lg flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-all duration-200 group disabled:opacity-60"
            >
              <Heart
                size={20}
                fill={wishlisted ? "var(--color-plum)" : "none"}
                className={`transition-all duration-200 ${wishlisted ? "text-[var(--color-plum)] scale-110" : "text-[var(--color-text-secondary)] group-hover:text-red-400 group-hover:scale-110"}`}
              />
            </button>
          </div>

          <button
            onClick={handleBuyNow}
            disabled={!inStock || !selectedVariant || isBuying || !isValidVariant}
            className="w-full py-4 rounded-lg text-sm font-semibold tracking-[0.06em] uppercase border-2 border-[var(--color-plum)] text-[var(--color-plum)] transition-all duration-300 hover:bg-[var(--color-plum)] hover:text-white disabled:opacity-40"
          >
            {isBuying ? "Redirecting..." : "Buy it Now"}
          </button>
        </div>


        {/* Trust badges — expanded */}
        <div className="grid grid-cols-2 small:grid-cols-3 gap-3 pt-6 border-t border-[var(--color-lavender)]">
          {[
            { icon: Award, label: "925 Hallmarked" },
            { icon: Truck, label: "Free Shipping" },
            { icon: ShieldCheck, label: "Secure Payment" },
            { icon: RefreshCw, label: "Easy Returns" },
            { icon: Package, label: "Premium Pack" },
            { icon: CheckCircle, label: "10K+ Trusted" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center text-center gap-1.5 py-2">
              <Icon size={18} strokeWidth={1.3} className="text-[var(--color-silver)]" />
              <span className="text-[9px] font-semibold tracking-[0.08em] uppercase text-[var(--color-text-secondary)] leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {shareOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShareOpen(false)}
          >
            <motion.div
              className="relative w-[90vw] max-w-[400px] rounded-2xl p-6 bg-white shadow-2xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="absolute top-4 right-4" onClick={() => setShareOpen(false)}>
                <X size={20} className="text-[var(--color-text-muted)]" />
              </button>

              <h3 className="font-wittgenstein text-[18px] font-semibold text-[var(--color-text-primary)] mb-1">Share this product</h3>
              <p className="text-[12px] text-[var(--color-text-muted)] mb-5">{product.title}</p>

              {/* QR Code */}
              <div className="flex justify-center mb-5">
                <div className="p-3 rounded-xl border border-[var(--color-lavender)] bg-[var(--color-bg-primary)]">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(shareUrl)}&color=5D2E46`}
                    alt="QR Code"
                    width={140}
                    height={140}
                  />
                </div>
              </div>
              <p className="text-[11px] text-center text-[var(--color-text-muted)] mb-5">Scan to view on mobile</p>

              {/* Social buttons */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: "WhatsApp", color: "#25D366", href: `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, icon: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" },
                  { label: "Facebook", color: "#1877F2", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, icon: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
                  { label: "X", color: "#1A1A1A", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, icon: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
                  { label: "Email", color: "#5D2E46", href: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`, icon: "" },
                ].map(({ label, color, href, icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[var(--color-lavender)] hover:border-[var(--color-gold)]/30 hover:shadow-sm transition-all"
                  >
                    {icon ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill={color}><path d={icon} /></svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    )}
                    <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">{label}</span>
                  </a>
                ))}
              </div>

              {/* Copy link */}
              <button
                onClick={copyLink}
                className={`w-full h-10 flex items-center justify-center gap-2 text-[12px] font-semibold rounded-lg border transition-all duration-200 ${
                  copied
                    ? "border-green-300 text-green-600 bg-green-50"
                    : "border-[var(--color-lavender)] text-[var(--color-text-secondary)] bg-white hover:border-[var(--color-plum)]"
                }`}
              >
                {copied ? "✓ Link Copied!" : "Copy Link"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wishlist Auth Modal */}
      <AnimatePresence>
        {wishlistAuthOpen && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black/50"
            style={{ zIndex: 99999 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWishlistAuthOpen(false)}
          >
            <motion.div
              className="relative w-[90vw] max-w-[400px] rounded-2xl overflow-hidden bg-white shadow-2xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close */}
              <button className="absolute top-4 right-4 z-10" onClick={() => setWishlistAuthOpen(false)}>
                <X size={20} className="text-[var(--color-text-muted)]" />
              </button>

              {/* Accent bar */}
              <div className="h-1 bg-gradient-to-r from-[var(--color-plum)] to-[var(--color-gold)]" />

              <div className="px-6 pt-6 pb-7">
                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-[var(--color-lavender)]/30 flex items-center justify-center">
                    <Heart size={24} strokeWidth={1.5} className="text-[var(--color-plum)]" />
                  </div>
                </div>

                <h3 className="font-wittgenstein text-[20px] font-semibold text-center text-[var(--color-text-primary)] mb-1">
                  {authMode === "login" ? "Welcome Back" : "Create Account"}
                </h3>
                <p className="text-[12px] text-center text-[var(--color-text-muted)] mb-5">
                  {authMode === "login" ? "Sign in to save to your wishlist" : "Join Delfee to save your favourites"}
                </p>

                {/* Error */}
                {authError && (
                  <div className="mb-4 px-3 py-2 rounded-lg text-[12px] bg-red-50 text-red-600 border border-red-100">
                    {authError}
                  </div>
                )}

                {/* Form */}
                <div className="flex flex-col gap-3 mb-4">
                  {authMode === "signup" && (
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="First Name *"
                        value={authForm.first_name}
                        onChange={(e) => { setAuthForm((f) => ({ ...f, first_name: e.target.value })); setAuthError("") }}
                        className="h-11 px-3 rounded-lg text-[13px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
                      />
                      <input
                        type="text"
                        placeholder="Last Name *"
                        value={authForm.last_name}
                        onChange={(e) => { setAuthForm((f) => ({ ...f, last_name: e.target.value })); setAuthError("") }}
                        className="h-11 px-3 rounded-lg text-[13px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
                      />
                    </div>
                  )}
                  <input
                    type="email"
                    placeholder="Email Address *"
                    value={authForm.email}
                    onChange={(e) => { setAuthForm((f) => ({ ...f, email: e.target.value })); setAuthError("") }}
                    className="h-11 px-3 rounded-lg text-[13px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all w-full"
                  />
                  <input
                    type="password"
                    placeholder="Password *"
                    value={authForm.password}
                    onChange={(e) => { setAuthForm((f) => ({ ...f, password: e.target.value })); setAuthError("") }}
                    className="h-11 px-3 rounded-lg text-[13px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all w-full"
                    onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                  />
                  {authMode === "signup" && (
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={authForm.phone}
                      onChange={(e) => setAuthForm((f) => ({ ...f, phone: e.target.value }))}
                      className="h-11 px-3 rounded-lg text-[13px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all w-full"
                    />
                  )}
                </div>

                {/* Submit */}
                <button
                  onClick={handleAuth}
                  disabled={authLoading}
                  className="w-full h-11 flex items-center justify-center text-[13px] font-semibold uppercase tracking-[0.08em] text-white rounded-lg transition-all duration-200 hover:opacity-90 disabled:opacity-50 bg-[var(--color-plum)]"
                >
                  {authLoading ? "Please wait..." : authMode === "login" ? "Login" : "Create Account"}
                </button>

                {/* Toggle */}
                <p className="text-center mt-4 text-[12px] text-[var(--color-text-muted)]">
                  {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
                  <button
                    onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError("") }}
                    className="font-semibold text-[var(--color-plum)] hover:underline underline-offset-2"
                  >
                    {authMode === "login" ? "Sign Up" : "Login"}
                  </button>
                </p>

                <button
                  onClick={() => setWishlistAuthOpen(false)}
                  className="w-full mt-3 text-[11px] text-center text-[var(--color-text-muted)] hover:text-[var(--color-plum)] transition-colors"
                >
                  Continue browsing
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA glossy gold styles */}
      <style>{`
        .pdp-v1-cta {
          background: linear-gradient(135deg, var(--color-gold) 0%, #e9c349 40%, var(--color-gold) 100%);
          position: relative;
          overflow: hidden;
        }
        .pdp-v1-cta::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transition: left 0.6s ease;
        }
        .pdp-v1-cta:hover:not(:disabled)::before {
          left: 100%;
        }
      `}</style>
    </motion.div>
  )
}
