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
  {
    icon_name: "Truck",
    title: "Free Shipping",
    description:
      "Complimentary insured delivery on all orders across India and select international cities.",
  },
  {
    icon_name: "ShieldCheck",
    title: "Easy Returns",
    description:
      "Hassle-free 15-day return policy. Your satisfaction is our highest priority.",
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
