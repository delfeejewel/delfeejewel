"use client"

export default function MobileStickyBar({ title, price }: { title: string; price: string }) {
  const scrollToCart = () => {
    const el = document.querySelector(".pdp-v1-cta")
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 small:hidden z-50 px-4 py-3 flex items-center gap-3 border-t border-[var(--color-lavender)] bg-[var(--color-bg-primary)]">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[var(--color-text-muted)] truncate capitalize">{title}</p>
        <p className="font-wittgenstein text-[18px] font-bold text-[var(--color-plum)]">{price}</p>
      </div>
      <button
        onClick={scrollToCart}
        className="pdp-v1-cta h-11 px-6 flex items-center justify-center text-[12px] font-semibold uppercase tracking-[0.06em] text-white rounded-lg shrink-0"
      >
        Add to Bag
      </button>
    </div>
  )
}
