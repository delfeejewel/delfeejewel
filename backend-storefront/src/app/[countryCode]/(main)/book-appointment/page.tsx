import { Metadata } from "next"
import { MapPin, Clock, Gem, ShieldCheck } from "lucide-react"

import { pageMetadata } from "@lib/util/content-seo"
import { BRAND } from "@lib/constants.brand"
import PageHero from "@modules/content/components/page-hero"
import AppointmentForm from "@modules/content/components/appointment-form"

type Props = { params: Promise<{ countryCode: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  return pageMetadata({
    countryCode,
    path: "/book-appointment",
    title: "Book an Appointment",
    description: `Book a private in-store visit with ${BRAND.name} — browse the collection, discuss a custom design, or get a piece valued. Pick a date and time that suits you.`,
  })
}

const PERKS = [
  { icon: Gem, title: "See pieces in person", text: "Try on from the collection with no obligation." },
  { icon: ShieldCheck, title: "Expert guidance", text: "Custom design, sizing, repairs and valuations." },
  { icon: Clock, title: "Your time, reserved", text: "We keep your slot so there's no waiting." },
]

export default async function BookAppointmentPage({ params }: Props) {
  await params

  return (
    <div className="bg-[var(--color-bg-primary)] font-outfit">
      <PageHero
        eyebrow="Visit Us"
        title="Book an Appointment"
        description="Reserve a private in-store visit — to browse, design something bespoke, or have a piece valued. Choose a time and we'll be ready for you."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Book an Appointment" }]}
      />

      <section className="page-container py-12 small:py-16">
        <div className="grid grid-cols-1 medium:grid-cols-[1fr_340px] gap-8 small:gap-10">
          {/* Form */}
          <div>
            <h2 className="font-wittgenstein text-[22px] small:text-[26px] font-bold text-[var(--color-plum)] mb-1.5">
              Choose your visit
            </h2>
            <p className="text-[14px] text-[var(--color-text-muted)] mb-6">
              Tell us a little about your visit and pick a time. You'll get an
              email confirmation with your reference.
            </p>
            <AppointmentForm />
          </div>

          {/* Aside */}
          <aside className="flex flex-col gap-4">
            <div className="flex gap-3.5 rounded-2xl bg-white border border-[var(--color-lavender)] p-5">
              <div className="w-11 h-11 rounded-xl bg-[var(--color-lavender)] flex items-center justify-center shrink-0">
                <MapPin size={20} className="text-[var(--color-plum)]" />
              </div>
              <div>
                <p className="font-semibold text-[14px] text-[var(--color-text-primary)]">Our store</p>
                <p className="text-[13.5px] text-[var(--color-plum)] font-medium mt-0.5">Chandigarh</p>
                <p className="text-[12.5px] text-[var(--color-text-muted)] mt-1 leading-relaxed">
                  The exact address is shared in your confirmation email.
                </p>
              </div>
            </div>

            {PERKS.map((p) => {
              const Icon = p.icon
              return (
                <div key={p.title} className="flex gap-3.5 rounded-2xl bg-white border border-[var(--color-lavender)] p-5">
                  <div className="w-11 h-11 rounded-xl bg-[var(--color-lavender)] flex items-center justify-center shrink-0">
                    <Icon size={20} className="text-[var(--color-plum)]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[14px] text-[var(--color-text-primary)]">{p.title}</p>
                    <p className="text-[12.5px] text-[var(--color-text-muted)] mt-1 leading-relaxed">{p.text}</p>
                  </div>
                </div>
              )
            })}
          </aside>
        </div>
      </section>
    </div>
  )
}
