import { Metadata } from "next"
import {
  Mail,
  MessageCircle,
  Clock,
  HelpCircle,
  RotateCcw,
  Truck,
  PackageSearch,
  ArrowRight,
  MapPin,
  Phone,
} from "lucide-react"

import { pageMetadata, jsonLd } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import { getBaseURL } from "@lib/util/env"
import { getContactForm } from "@lib/data/cms"
import PageHero from "@modules/content/components/page-hero"
import ContactForm from "@modules/content/components/contact-form"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Props = { params: Promise<{ countryCode: string }> }

const SUPPORT_EMAIL = "enquire@delfee.in"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  return pageMetadata({
    countryCode,
    path: "/contact",
    title: "Contact Us",
    description: `Get in touch with the ${BRAND.name} customer care team — questions about orders, products, returns or anything else. We're happy to help.`,
  })
}

const DEFAULT_CHANNELS = [
  {
    icon: Mail,
    title: "Email Us",
    text: SUPPORT_EMAIL,
    sub: "We reply within 24–48 business hours.",
    href: `mailto:${SUPPORT_EMAIL}`,
  },
  {
    icon: MessageCircle,
    title: "Chat on WhatsApp",
    text: "Quick help, 7 days a week",
    sub: "Tap to start a conversation with our team.",
    href: "#",
  },
  {
    icon: Clock,
    title: "Support Hours",
    text: "Mon–Sat, 10:00 AM – 7:00 PM IST",
    sub: "Messages outside hours are answered next day.",
    href: null as string | null,
  },
]

const QUICK_LINKS = [
  { icon: PackageSearch, label: "Track an Order", href: "/account/orders" },
  { icon: RotateCcw, label: "Returns & Exchange", href: "/returns-and-exchange" },
  { icon: Truck, label: "Shipping Policy", href: "/shipping-policy" },
  { icon: HelpCircle, label: "Browse FAQs", href: "/faq" },
]

export default async function ContactPage({ params }: Props) {
  const { countryCode } = await params

  const cfg = await getContactForm()

  // Side-panel cards: CMS config when present, else the built-in defaults.
  // (href "" or "#" → render as a non-link card.)
  const cleanHref = (h?: string | null) =>
    h && h !== "#" ? h : null
  const channels = cfg
    ? [
        { icon: Mail, ...cfg.email_card, href: cleanHref(cfg.email_card?.href) },
        { icon: MessageCircle, ...cfg.whatsapp_card, href: cleanHref(cfg.whatsapp_card?.href) },
        { icon: Clock, ...cfg.hours_card, href: cleanHref(cfg.hours_card?.href) },
      ]
    : DEFAULT_CHANNELS

  const heading = cfg?.heading || "Send us a message"
  const subheading =
    cfg?.subheading || "Fill in the form and we'll get back to you as soon as we can."

  const contactLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    url: `${getBaseURL()}/${countryCode}`,
    contactPoint: {
      "@type": "ContactPoint",
      email: SUPPORT_EMAIL,
      contactType: "customer support",
      areaServed: "IN",
      availableLanguage: ["English", "Hindi"],
    },
  }

  return (
    <div className="bg-[var(--color-bg-primary)] font-outfit">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(contactLd)}
      />

      <PageHero
        eyebrow="Get in Touch"
        title="We'd Love to Hear From You"
        description="Whether it's a question about an order, a product, or sizing — our customer care team is here to help."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Contact Us" }]}
      />

      <section className="page-container py-12 small:py-16">
        <div className="grid grid-cols-1 medium:grid-cols-[1fr_340px] gap-8 small:gap-10">
          {/* Form */}
          <div>
            <h2 className="font-wittgenstein text-[22px] small:text-[26px] font-bold text-[var(--color-plum)] mb-1.5">
              {heading}
            </h2>
            <p className="text-[14px] text-[var(--color-text-muted)] mb-6">
              {subheading}
            </p>
            <ContactForm
              subjects={cfg?.subjects}
              submitLabel={cfg?.submit_label}
              successTitle={cfg?.success_title}
              successMessage={cfg?.success_message}
            />
          </div>

          {/* Channels */}
          <aside className="flex flex-col gap-4">
            {/* Visit Us — real registered business address (always shown) */}
            <div className="flex gap-3.5 rounded-2xl bg-white border border-[var(--color-lavender)] p-5">
              <div className="w-11 h-11 rounded-xl bg-[var(--color-lavender)] flex items-center justify-center shrink-0">
                <MapPin size={20} className="text-[var(--color-plum)]" />
              </div>
              <div>
                <p className="font-semibold text-[14px] text-[var(--color-text-primary)]">
                  Visit Us
                </p>
                <address className="not-italic text-[13.5px] text-[var(--color-plum)] font-medium mt-0.5 leading-relaxed">
                  {BRAND.legalName} ({BRAND.name})
                  <br />
                  {BRAND.contact.addressLines.map((line, i) => (
                    <span key={i}>
                      {line}
                      <br />
                    </span>
                  ))}
                </address>
                <a
                  href={BRAND.contact.phoneHref}
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-text-muted)] mt-2 hover:text-[var(--color-plum)] transition-colors"
                >
                  <Phone size={13} /> {BRAND.contact.phone}
                </a>
              </div>
            </div>
            {channels.map((c) => {
              const Icon = c.icon
              const inner = (
                <>
                  <div className="w-11 h-11 rounded-xl bg-[var(--color-lavender)] flex items-center justify-center shrink-0">
                    <Icon size={20} className="text-[var(--color-plum)]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[14px] text-[var(--color-text-primary)]">
                      {c.title}
                    </p>
                    <p className="text-[13.5px] text-[var(--color-plum)] font-medium mt-0.5">
                      {c.text}
                    </p>
                    <p className="text-[12.5px] text-[var(--color-text-muted)] mt-1 leading-relaxed">
                      {c.sub}
                    </p>
                  </div>
                </>
              )
              return c.href ? (
                <a
                  key={c.title}
                  href={c.href}
                  className="flex gap-3.5 rounded-2xl bg-white border border-[var(--color-lavender)] p-5 hover:border-[var(--color-gold)]/50 transition-colors"
                >
                  {inner}
                </a>
              ) : (
                <div
                  key={c.title}
                  className="flex gap-3.5 rounded-2xl bg-white border border-[var(--color-lavender)] p-5"
                >
                  {inner}
                </div>
              )
            })}
          </aside>
        </div>
      </section>

      {/* Quick links */}
      <section className="bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
        <div className="page-container py-12 small:py-16">
          <div className="text-center max-w-xl mx-auto mb-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">
              Looking for something specific?
            </span>
            <h2 className="font-wittgenstein text-[24px] small:text-[30px] font-bold text-[var(--color-plum)] mt-2">
              You might find it faster here
            </h2>
          </div>
          <div className="grid grid-cols-2 medium:grid-cols-4 gap-4">
            {QUICK_LINKS.map((q) => {
              const Icon = q.icon
              return (
                <LocalizedClientLink
                  key={q.label}
                  href={q.href}
                  className="group flex flex-col items-center text-center gap-3 rounded-2xl bg-white border border-[var(--color-lavender)] p-6 hover:border-[var(--color-gold)]/50 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-lavender)] flex items-center justify-center">
                    <Icon size={22} className="text-[var(--color-plum)]" />
                  </div>
                  <span className="text-[13.5px] font-semibold text-[var(--color-text-primary)] flex items-center gap-1">
                    {q.label}
                    <ArrowRight
                      size={13}
                      className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[var(--color-plum)]"
                    />
                  </span>
                </LocalizedClientLink>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
