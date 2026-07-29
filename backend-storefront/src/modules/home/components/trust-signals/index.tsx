import {
  HandMetal,
  Truck,
  ShieldCheck,
  Gem,
  Award,
  Sparkles,
  Heart,
  BadgeCheck,
  Package,
  RefreshCw,
  type LucideIcon,
} from "lucide-react"

export type ExperienceFeature = {
  title: string
  description?: string | null
  icon_name?: string | null
}

const ICON_MAP: Record<string, LucideIcon> = {
  HandMetal,
  Truck,
  ShieldCheck,
  Gem,
  Award,
  Sparkles,
  Heart,
  BadgeCheck,
  Package,
  RefreshCw,
}

const DEFAULT_SIGNALS: ExperienceFeature[] = [
  {
    icon_name: "HandMetal",
    title: "Handcrafted in India",
    description:
      "Every piece is meticulously crafted by skilled Indian artisans preserving century-old techniques.",
  },
  // Replaces the previous "Free Shipping" and "Easy Returns" badges, both of
  // which overstated the actual policies: shipping is only free above ₹5,000
  // (see shipping-policy), and the return window is 7 days, not 15 (see
  // returns-and-exchange). These two make no promise the store doesn't keep —
  // the purity claim mirrors the Authenticity page, and every Shiprocket
  // fulfilment carries an AWB that /track-order can look up.
  {
    icon_name: "Gem",
    title: "925 Sterling Silver",
    description:
      "Every piece is 92.5% pure sterling silver, alloyed for strength — the international standard for fine silver.",
  },
  {
    icon_name: "Package",
    title: "Tracked Delivery",
    description:
      "Orders ship with a tracking number, so you can follow your parcel from dispatch to your door.",
  },
]

export default function TrustSignals({
  features,
}: {
  features?: ExperienceFeature[] | null
}) {
  const signals = features && features.length ? features : DEFAULT_SIGNALS

  return (
    <section className="bg-white py-16 small:py-20 border-t border-[var(--color-border)]">
      <div className="max-w-[1400px] w-full mx-auto px-6 grid grid-cols-1 tablet:grid-cols-3 gap-10 small:gap-12 text-center">
        {signals.map((signal) => {
          const Icon = ICON_MAP[signal.icon_name || ""] || ShieldCheck
          return (
            <div
              key={signal.title}
              className="flex flex-col items-center group"
            >
              <div className="w-16 h-16 [background:var(--color-lavender)] rounded-full flex items-center justify-center text-[var(--color-gold)] mb-6 group-hover:scale-110 transition-transform duration-300">
                <Icon className="w-7 h-7" />
              </div>
              <h4 className="font-wittgenstein text-lg text-[var(--color-plum)] mb-2">
                {signal.title}
              </h4>
              <p className="text-sm text-[var(--color-text-muted)] max-w-xs">
                {signal.description}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
