import { Star } from "lucide-react"

export type Review = {
  name: string
  rating: number
  ratingCount: number | null
  text: string
  product: string
  productImage: string
  location: string
  date: string
}

const DEFAULT_REVIEWS = [
  {
    text: "The craftsmanship of the Celestial Studs is incredible. They sparkle even in low light and have become my daily staple. Packaging was also very premium!",
    name: "Ananya Sharma",
  },
  {
    text: "I bought the Mandala Cuff for my mother's birthday. She absolutely loved the intricate details. Truly a timeless piece of Indian heritage.",
    name: "Rohan Mehra",
  },
  {
    text: "Their modern interpretation of traditional motifs is what keeps me coming back. Excellent customer service too.",
    name: "Priya Kapoor",
  },
]

export default function Testimonials({ reviews }: { reviews?: Review[] | null }) {
  const items = (reviews && reviews.length ? reviews : DEFAULT_REVIEWS).map(
    (r) => ({
      text: r.text,
      name: r.name,
      initial: r.name.charAt(0).toUpperCase(),
    })
  )

  return (
    <section className="py-16 small:py-20 [background:var(--color-lavender)]">
      <div className="max-w-[1400px] w-full mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="font-semibold text-xs tracking-[0.2em] uppercase text-[var(--color-gold)]">
            Love Letters
          </span>
          <h2 className="font-wittgenstein text-2xl small:text-3xl text-[var(--color-plum)] mt-2">
            What Our Collectors Say
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 small:grid-cols-3 gap-8">
          {items.map((review) => (
            <div
              key={review.name}
              className="bg-white p-8 rounded-2xl shadow-sm border border-[var(--color-border)] hover:shadow-lg transition-shadow duration-300"
            >
              {/* Stars */}
              <div className="flex gap-1 text-[var(--color-gold)] mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>

              <p className="text-[var(--color-text-primary)] mb-6 leading-relaxed">
                &ldquo;{review.text}&rdquo;
              </p>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 [background:var(--color-lavender-soft)] rounded-full flex items-center justify-center font-wittgenstein text-lg text-[var(--color-plum)]">
                  {review.initial}
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-plum)]">
                    {review.name}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-[0.15em]">
                    Verified Buyer
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
