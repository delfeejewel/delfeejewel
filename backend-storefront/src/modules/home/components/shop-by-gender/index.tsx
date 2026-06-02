import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const GENDERS = [
  {
    label: "For Her",
    description: "Elegant pieces that celebrate her grace — from everyday studs to statement necklaces.",
    image: "/images/shop-by-gender_for-her.png",
    cta: "Shop Women",
    link: "/store",
    overlay: "from-[var(--color-plum-deep)]/80 via-[var(--color-plum-deep)]/30 to-transparent",
    textColor: "text-white",
    btnClass: "bg-white text-[var(--color-plum-deep)] hover:[background:var(--color-gold)] hover:text-white",
  },
  {
    label: "For Him",
    description: "Bold, minimal designs crafted for the modern man — rings, bracelets & chains.",
    image: "/images/shop-by-gender_for-him.png",
    cta: "Shop Men",
    link: "/store",
    overlay: "from-[var(--color-plum)]/80 via-[var(--color-plum)]/30 to-transparent",
    textColor: "text-white",
    btnClass: "[background:var(--color-gold)] text-[var(--color-plum-deep)] hover:bg-white hover:text-[var(--color-plum)]",
  },
]

export default function ShopByGender() {
  return (
    <section className="py-16 small:py-24">
      <div className="page-container">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[var(--color-gold)]">
            Curated Collections
          </span>
          <h2 className="font-wittgenstein text-[26px] small:text-[32px] font-semibold text-[var(--color-text-primary)] mt-2">
            Shop by Recipient
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-6">
          {GENDERS.map((item) => (
            <div
              key={item.label}
              className="relative h-[400px] small:h-[480px] rounded-3xl overflow-hidden group shadow-lg"
            >
              <Image
                src={item.image}
                alt={item.label}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-1000"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className={`absolute inset-0 bg-gradient-to-t ${item.overlay} p-8 small:p-12 flex flex-col justify-end`}>
                {/* Tag */}
                <span className="inline-block self-start px-3 py-1 rounded-full border border-[var(--color-gold)]/40 text-[var(--color-gold)] text-[10px] font-bold uppercase tracking-[0.15em] mb-4">
                  {item.label}
                </span>

                <h3 className={`font-wittgenstein text-[28px] small:text-[36px] font-bold ${item.textColor} mb-3 leading-tight`}>
                  {item.label === "For Her" ? "Her Kind of\nElegance" : "His Kind of\nStatement"}
                </h3>
                <p className={`${item.textColor}/80 text-[14px] small:text-[15px] mb-6 max-w-sm leading-relaxed`}>
                  {item.description}
                </p>
                <LocalizedClientLink
                  href={item.link}
                  className={`self-start px-8 py-3 rounded-full font-semibold text-[13px] tracking-wide transition-all duration-300 hover:-translate-y-0.5 shadow-md ${item.btnClass}`}
                >
                  {item.cta}
                </LocalizedClientLink>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
