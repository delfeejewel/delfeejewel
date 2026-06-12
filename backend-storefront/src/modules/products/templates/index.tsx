import React, { Suspense } from "react"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import ProductGallery from "@modules/products/components/gallery"
import ProductInfo from "@modules/products/components/product-info"
import ProductDetails from "@modules/products/components/product-details"
import ProductReviewsSection from "@modules/products/components/reviews/section"
import RelatedProducts from "@modules/products/components/related-products"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getProductPrice } from "@lib/util/get-product-price"

// ─── Mobile Sticky Bar (Client) ──────────────────────
import MobileStickyBar from "@modules/products/components/mobile-sticky-bar"
import RecentlyViewedTracker from "@modules/products/components/recently-viewed-tracker"
import { getProductReviews } from "@lib/data/reviews"

// ─── Breadcrumb ──────────────────────────────────────
function Breadcrumb({ product }: { product: HttpTypes.StoreProduct }) {
  const category = (product as any).categories?.[0]
  const collection = product.collection

  // Priority: category > collection > "Products"
  const middle = category
    ? { label: category.name, href: `/categories/${category.handle}` }
    : collection
      ? { label: collection.title, href: `/collections/${collection.handle}` }
      : { label: "Products", href: "/store" }

  return (
    <nav className="flex items-center gap-2 mb-10 text-[12px] font-medium tracking-[0.04em] text-[var(--color-text-muted)]">
      <LocalizedClientLink href="/" className="hover:text-[var(--color-plum)] transition-colors duration-200">
        Home
      </LocalizedClientLink>
      <span className="text-[var(--color-border)]">/</span>
      <LocalizedClientLink href={middle.href} className="hover:text-[var(--color-plum)] transition-colors duration-200">
        {middle.label}
      </LocalizedClientLink>
      <span className="text-[var(--color-border)]">/</span>
      <span className="text-[var(--color-text-primary)] capitalize">{product.title}</span>
    </nav>
  )
}

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[] | undefined
  isLoggedIn: boolean
  initialWishlisted: boolean
}

const ProductTemplate = async ({
  product,
  region,
  countryCode,
  images,
  isLoggedIn,
  initialWishlisted,
}: ProductTemplateProps) => {
  if (!product || !product.id) return notFound()

  // Rating summary for the PDP header (stars + count). Same fetch the reviews
  // section uses below — deduped/cached by Next, so no extra round-trip.
  const { summary: reviewSummary } = await getProductReviews(product.id)

  // Media = product images (videos auto-detected by extension) + any URLs in
  // metadata.videos (array or comma-separated string). Videos render as <video>.
  const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i
  const productMeta = (product.metadata || {}) as Record<string, any>
  const metaVideos: string[] = Array.isArray(productMeta.videos)
    ? productMeta.videos
    : typeof productMeta.videos === "string"
      ? productMeta.videos.split(",").map((s: string) => s.trim()).filter(Boolean)
      : []
  const galleryMedia = [
    ...(images || product.images || []).map((img) => ({
      id: img.id,
      url: img.url,
      type: (VIDEO_RE.test(img.url) ? "video" : "image") as "image" | "video",
    })),
    ...metaVideos.map((url, i) => ({
      id: `meta-video-${i}`,
      url,
      type: "video" as "image" | "video",
    })),
  ]

  return (
    <div className="relative bg-[var(--color-bg-primary)] min-h-screen font-outfit">
      {/* ═══ Background decorations (in own overflow-hidden layer) ═══ */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">

        {/* Noise texture */}
        <div className="fixed inset-0 opacity-[0.012] pdp-noise" />

        {/* Ambient glow — top left lavender */}
        <div className="fixed top-0 left-0 w-[600px] h-[600px] pointer-events-none z-0 opacity-20 pdp-glow-1" />

        {/* Ambient glow — bottom right gold */}
        <div className="fixed bottom-0 right-0 w-[500px] h-[500px] pointer-events-none z-0 opacity-10 pdp-glow-2" />

        {/* ── Floating jewellery icons (hidden on mobile) ── */}

        {/* Diamond — top right */}
        <svg className="absolute top-28 right-14 w-20 h-20 pointer-events-none z-0 opacity-[0.04] pdp-float-1 hidden small:block" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--color-plum)" }}>
          <path d="M12 2L2 12l10 10 10-10L12 2zm0 3.41L18.59 12 12 18.59 5.41 12 12 5.41z" />
        </svg>

        {/* Diamond outline — top left area */}
        <svg className="absolute top-48 left-[8%] w-14 h-14 pointer-events-none z-0 opacity-[0.035] pdp-float-4 hidden small:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: "var(--color-plum)" }}>
          <path d="M6 3h12l4 6-10 13L2 9z" />
          <path d="M2 9h20" />
          <path d="M10 3l-2 6 4 13 4-13-2-6" />
        </svg>

        {/* Gem / teardrop — right side mid page */}
        <svg className="absolute top-[45%] right-8 w-16 h-16 pointer-events-none z-0 opacity-[0.03] pdp-float-2 hidden small:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" style={{ color: "var(--color-gold)" }}>
          <path d="M12 22c-4-4-8-7.5-8-11a8 8 0 0 1 16 0c0 3.5-4 7-8 11z" />
          <circle cx="12" cy="11" r="3" />
        </svg>

        {/* Ring icon — left side */}
        <svg className="absolute top-[62%] left-4 w-24 h-24 pointer-events-none z-0 opacity-[0.025] pdp-float-3 hidden small:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" style={{ color: "var(--color-gold)" }}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="6" r="1.5" fill="currentColor" />
        </svg>

        {/* Sparkle star — right near reviews */}
        <svg className="absolute top-[78%] right-20 w-14 h-14 pointer-events-none z-0 opacity-[0.04] pdp-float-5 hidden small:block" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--color-gold)" }}>
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
        </svg>

        {/* Small diamond cluster — bottom left */}
        <svg className="absolute bottom-[15%] left-[5%] w-10 h-10 pointer-events-none z-0 opacity-[0.04] pdp-float-6 hidden small:block" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--color-plum)" }}>
          <path d="M12 2L2 12l10 10 10-10L12 2zm0 3.41L18.59 12 12 18.59 5.41 12 12 5.41z" />
        </svg>

        {/* Necklace chain — top center */}
        <svg className="absolute top-20 left-[40%] w-28 h-12 pointer-events-none z-0 opacity-[0.025] pdp-float-7 hidden small:block" viewBox="0 0 120 40" fill="none" stroke="currentColor" strokeWidth="0.6" style={{ color: "var(--color-plum)" }}>
          <path d="M10 20 Q30 5 60 20 Q90 35 110 20" />
          <circle cx="60" cy="20" r="4" fill="currentColor" opacity="0.5" />
        </svg>

        {/* Small sparkles scattered — right mid */}
        <svg className="absolute top-[35%] right-[4%] w-8 h-8 pointer-events-none z-0 opacity-[0.05] pdp-float-1 hidden small:block" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--color-gold)" }}>
          <path d="M12 6l1 3.5L16.5 12 13 13l-1 3.5L11 13 7.5 12 11 9.5 12 6z" />
        </svg>

        {/* Another sparkle — left mid */}
        <svg className="absolute top-[40%] left-[3%] w-6 h-6 pointer-events-none z-0 opacity-[0.04] pdp-float-5 hidden small:block" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--color-gold)" }}>
          <path d="M12 6l1 3.5L16.5 12 13 13l-1 3.5L11 13 7.5 12 11 9.5 12 6z" />
        </svg>

        {/* Dot pattern — behind specs */}
        <div className="absolute top-[50%] left-0 w-32 h-64 pointer-events-none z-0 opacity-[0.025] hidden small:block"
          style={{
            backgroundImage: "radial-gradient(circle, var(--color-plum) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Dot pattern — right side */}
        <div className="absolute top-[25%] right-0 w-24 h-48 pointer-events-none z-0 opacity-[0.02] hidden small:block"
          style={{
            backgroundImage: "radial-gradient(circle, var(--color-gold) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Animated gradient orb — moves slowly */}
        <div className="absolute top-[30%] right-[10%] w-[300px] h-[300px] pdp-orb" />

      </div>{/* end decorations wrapper */}

      <div className="relative z-10">
        {/* Product Hero — sticky gallery + scrollable right content */}
        <div className="page-container pt-8 pb-12 small:pb-24">
          <div className="grid grid-cols-1 medium:grid-cols-12 gap-8 medium:gap-14 items-start">
            {/* Left: sticky column — breadcrumb + gallery */}
            <div className="medium:col-span-5 medium:sticky medium:top-[140px] medium:pt-4">
              <div className="mb-4">
                <Breadcrumb product={product} />
              </div>
              <ProductGallery media={galleryMedia} title={product.title || "Product"} />
            </div>
            {/* Right: scrollable content */}
            <div className="medium:col-span-7">
              <ProductInfo
                product={product}
                region={region}
                isLoggedIn={isLoggedIn}
                initialWishlisted={initialWishlisted}
                reviewSummary={reviewSummary}
              />

              {/* Gradient divider */}
              <div className="my-12 small:my-16">
                <div className="h-px pdp-divider" />
              </div>

              {/* Description + Specs + Story — full width in right column */}
              <ProductDetails product={product} />
            </div>
          </div>
        </div>

        {/* Related products */}
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>

        {/* Reviews */}
        <div className="page-container py-12 small:py-24">
          <Suspense fallback={null}>
            <ProductReviewsSection productId={product.id} />
          </Suspense>
        </div>
      </div>

      {/* Mobile sticky Add to Cart bar */}
      <MobileStickyBar title={product.title || ""} price={(() => { const { cheapestPrice: cp } = getProductPrice({ product }); return cp?.calculated_price || "—" })()} />

      {/* Records the product visit for the /store recently-viewed strip */}
      <RecentlyViewedTracker productId={product.id} />

      {/* Bottom spacer for mobile sticky bar */}
      <div className="h-16 small:hidden" />

      {/* ═══ Styles for decorations + animations ═══ */}
      <style>{`
        .pdp-noise {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .pdp-glow-1 {
          background: radial-gradient(circle, var(--color-lavender) 0%, transparent 70%);
          filter: blur(80px);
        }
        .pdp-glow-2 {
          background: radial-gradient(circle, var(--color-gold) 0%, transparent 70%);
          filter: blur(100px);
        }
        .pdp-orb {
          background: radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 60%);
          filter: blur(60px);
          animation: pdp-orb-move 20s ease-in-out infinite;
        }
        .pdp-divider {
          background: linear-gradient(to right, transparent, var(--color-lavender), var(--color-gold), var(--color-lavender), transparent);
          background-size: 200% 100%;
          animation: pdp-shimmer 4s ease-in-out infinite;
        }
        .pdp-float-1 { animation: pdp-float 8s ease-in-out infinite; }
        .pdp-float-2 { animation: pdp-float 10s ease-in-out infinite 1s; }
        .pdp-float-3 { animation: pdp-float 7s ease-in-out infinite 2s; }
        .pdp-float-4 { animation: pdp-float 9s ease-in-out infinite 0.5s; }
        .pdp-float-5 { animation: pdp-float 11s ease-in-out infinite 3s; }
        .pdp-float-6 { animation: pdp-float 8s ease-in-out infinite 1.5s; }
        .pdp-float-7 { animation: pdp-float-chain 6s ease-in-out infinite; }

        @keyframes pdp-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(3deg); }
        }
        @keyframes pdp-float-chain {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-6px) rotate(1deg); }
        }
        @keyframes pdp-orb-move {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(30px, -20px); }
          50% { transform: translate(-20px, 30px); }
          75% { transform: translate(15px, 15px); }
        }
        @keyframes pdp-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

export default ProductTemplate
