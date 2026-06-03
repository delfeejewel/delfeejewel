import { Metadata } from "next"
import { LifeBuoy, ArrowRight } from "lucide-react"

import { pageMetadata, jsonLd } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import PageHero from "@modules/content/components/page-hero"
import FaqAccordion, {
  FaqItem,
} from "@modules/content/components/faq-accordion"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Props = { params: Promise<{ countryCode: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  return pageMetadata({
    countryCode,
    path: "/faq",
    title: "Frequently Asked Questions",
    description: `Answers to common questions about ${BRAND.name} orders, shipping, returns, jewellery care and your account.`,
  })
}

const CATEGORIES: { name: string; items: FaqItem[] }[] = [
  {
    name: "Orders & Payment",
    items: [
      {
        question: "How do I place an order?",
        answer:
          "Browse our collection, choose your options (such as size), add the item to your bag and proceed to checkout. You'll receive an order confirmation by email once payment is complete.",
      },
      {
        question: "What payment methods do you accept?",
        answer:
          "We accept major credit and debit cards, UPI, net banking and wallets through our secure payment partners. Cash on Delivery may be available at checkout for eligible pincodes.",
      },
      {
        question: "Can I modify or cancel my order?",
        answer:
          "Orders can be modified or cancelled before they are dispatched. Contact us as soon as possible with your order number and we'll help if the order hasn't shipped yet.",
      },
    ],
  },
  {
    name: "Shipping & Delivery",
    items: [
      {
        question: "How long will my order take to arrive?",
        answer:
          "Orders are processed in 1–2 business days. Domestic delivery typically takes 3–8 business days after dispatch depending on your location. See our Shipping Policy for full details.",
      },
      {
        question: "Do you offer free shipping?",
        answer:
          "Yes — we offer free standard shipping on domestic orders above ₹999. A nominal fee applies to smaller orders and is shown at checkout.",
      },
      {
        question: "How do I track my order?",
        answer:
          "Once your order ships you'll receive a tracking link by email. You can also check live status anytime under My Orders in your account.",
      },
      {
        question: "Do you ship internationally?",
        answer:
          "Yes, we ship to select international destinations. Delivery usually takes 10–18 business days. Any customs duties or import taxes are the recipient's responsibility.",
      },
    ],
  },
  {
    name: "Returns & Exchange",
    items: [
      {
        question: "What is your return policy?",
        answer:
          "You can request a return or exchange within 7 days of delivery, provided the item is unused and in its original condition with all packaging and certificates. See our Returns & Exchange page for full details.",
      },
      {
        question: "How do I start a return?",
        answer:
          "Email enquire@delfee.in with your order number and reason, or use our Contact page. Our team will confirm eligibility and arrange a pickup.",
      },
      {
        question: "When will I receive my refund?",
        answer:
          "Once we receive and inspect your returned item, approved refunds are processed to your original payment method within 5–7 business days.",
      },
    ],
  },
  {
    name: "Products & Jewellery Care",
    items: [
      {
        question: "Is your jewellery real sterling silver?",
        answer:
          "Yes. All our silver jewellery is 925 sterling silver and BIS hallmarked, certifying its purity. Learn more on our Authenticity & Hallmarking page.",
      },
      {
        question: "How do I care for my silver jewellery?",
        answer:
          "Keep it dry, store it in an airtight pouch, and avoid contact with perfume, lotion and water. Our Jewellery Care guide has simple step-by-step tips.",
      },
      {
        question: "Will the jewellery tarnish over time?",
        answer:
          "Silver can naturally tarnish with exposure to air and moisture. This is normal and easily reversed with gentle cleaning — see our Jewellery Care guide.",
      },
      {
        question: "How do I find my ring size?",
        answer:
          "Use our Ring Size Guide to measure at home with a piece of string or an existing ring. If you're between sizes, we recommend choosing the larger one.",
      },
    ],
  },
  {
    name: "Account & Wishlist",
    items: [
      {
        question: "Do I need an account to shop?",
        answer:
          "You can browse freely, but an account lets you track orders, save addresses and build a wishlist. Creating one takes less than a minute.",
      },
      {
        question: "How does the wishlist work?",
        answer:
          "Tap the heart icon on any product to save it to your wishlist. Your saved pieces are available anytime under Wishlist in your account.",
      },
    ],
  },
]

export default async function FaqPage({ params }: Props) {
  await params

  const allItems = CATEGORIES.flatMap((c) => c.items)
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allItems.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  }

  return (
    <div className="bg-[var(--color-bg-primary)] font-outfit">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(faqLd)}
      />

      <PageHero
        eyebrow="Help Centre"
        title="Frequently Asked Questions"
        description="Quick answers to the questions we hear most. Can't find what you're looking for? Our team is one message away."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "FAQ" }]}
      />

      <section className="page-container py-12 small:py-16">
        <div className="max-w-[820px] mx-auto flex flex-col gap-12">
          {CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <h2 className="font-wittgenstein text-[22px] small:text-[26px] font-bold text-[var(--color-plum)] mb-5">
                {cat.name}
              </h2>
              <FaqAccordion items={cat.items} startOpen={null} />
            </div>
          ))}

          {/* Still need help */}
          <div className="flex flex-col items-center text-center gap-3 p-8 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="w-12 h-12 rounded-full bg-[var(--color-plum)] flex items-center justify-center">
              <LifeBuoy size={22} className="text-[var(--color-gold)]" />
            </div>
            <h3 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)]">
              Still need help?
            </h3>
            <p className="text-[14px] text-[var(--color-text-muted)] max-w-md">
              Our customer care team is happy to answer anything that isn't
              covered here.
            </p>
            <LocalizedClientLink
              href="/contact"
              className="mt-1 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] transition-all"
            >
              Contact Us
              <ArrowRight size={15} />
            </LocalizedClientLink>
          </div>
        </div>
      </section>
    </div>
  )
}
