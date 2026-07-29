/**
 * Loading placeholder for ProductCard.
 *
 * Mirrors the card's real geometry — 3/4 image, then title / rating / price —
 * so the grid does not reflow when the products arrive.
 *
 * Listing pages fetch the first batch and then pull the rest of the catalogue
 * page by page. Rendering the partial batch as real tiles meant the grid filled
 * in progressively while the count, filters and pagination underneath it were
 * still wrong; showing skeletons until the catalogue is complete keeps the page
 * honest about the fact that it is still loading.
 */
const Line = ({ className = "" }: { className?: string }) => (
  <div
    className={`rounded animate-pulse ${className}`}
    style={{ background: "var(--color-bg-secondary)" }}
  />
)

export default function ProductCardSkeleton() {
  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-border)" }}
      aria-hidden="true"
    >
      {/* Image */}
      <div
        className="animate-pulse"
        style={{ aspectRatio: "3/4", background: "var(--color-bg-secondary)" }}
      />

      {/* Info */}
      <div className="p-3 small:p-4">
        <Line className="h-[13px] w-[85%] mb-1.5" />
        <Line className="h-[13px] w-[55%] mb-2.5" />

        {/* Rating row */}
        <div className="flex items-center gap-1 mb-2.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Line key={i} className="w-[10px] h-[10px] rounded-full" />
          ))}
          <Line className="h-[10px] w-6 ml-0.5" />
        </div>

        {/* Price */}
        <Line className="h-4 w-20" />
      </div>
    </div>
  )
}

/** A full grid of skeleton cards, for the initial/catalogue-loading state. */
export function ProductCardSkeletonGrid({
  count = 12,
  gridClass = "grid-cols-2 small:grid-cols-3 medium:grid-cols-4",
}: {
  count?: number
  gridClass?: string
}) {
  return (
    <div
      className={`grid ${gridClass} gap-3 small:gap-4`}
      role="status"
      aria-label="Loading products"
    >
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
