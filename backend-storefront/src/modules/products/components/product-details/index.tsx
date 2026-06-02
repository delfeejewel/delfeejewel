"use client"

import { useRef } from "react"
import { HttpTypes } from "@medusajs/types"
import { motion, useInView } from "framer-motion"
import { Leaf, History, Gem, Droplets, Shield, Sparkles, HandMetal } from "lucide-react"

type Props = {
  product: HttpTypes.StoreProduct
}

// Reusable feature card
function FeatureCard({ icon: Icon, title, desc, delay }: { icon: any; title: string; desc: string; delay: number }) {
  return (
    <motion.div
      className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-[var(--color-lavender)]/50 hover:shadow-md hover:border-[var(--color-gold)]/30 transition-all duration-300"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
    >
      <div className="w-10 h-10 rounded-full bg-[var(--color-lavender)]/30 flex items-center justify-center shrink-0">
        <Icon size={18} strokeWidth={1.5} className="text-[var(--color-gold)]" />
      </div>
      <div>
        <p className="text-xs font-semibold tracking-[0.05em] text-[var(--color-text-primary)]">{title}</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">{desc}</p>
      </div>
    </motion.div>
  )
}

// Reusable spec row
function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between items-center py-3 border-b border-[var(--color-lavender)]/60 last:border-b-0">
      <span className="text-[14px] text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-[14px] font-medium text-[var(--color-text-primary)]">{value}</span>
    </li>
  )
}

export default function ProductDetails({ product }: Props) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  const meta = (product.metadata || {}) as Record<string, any>

  const specs = [
    { label: "Material", value: product.material || meta.metal || "925 Sterling Silver" },
    { label: "Dimensions", value: meta.dimensions || "-" },
    { label: "Weight", value: product.weight ? `${product.weight}g` : "-" },
    { label: "Finish", value: meta.finish || "High-Polish Silver" },
    { label: "Purity", value: meta.purity || "92.5%" },
    { label: "Origin", value: product.origin_country || "India" },
  ].filter(({ value }) => value !== "-")

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.5 }}
    >
      <div className="space-y-12">
        {/* Description + Features — full width */}
        <div className="space-y-12">
          {/* Description */}
          <section>
            <h2 className="font-wittgenstein text-[24px] small:text-[26px] font-semibold text-[var(--color-text-primary)] mb-6">
              Description
            </h2>
            <p className="text-[16px] small:text-[18px] leading-[1.8] text-[var(--color-text-secondary)]">
              {product.description || "A beautifully handcrafted piece of jewellery designed to be treasured for a lifetime. Each detail is meticulously finished by our master silversmiths."}
            </p>
          </section>

          {/* Feature cards grid */}
          <section>
            <div className="grid grid-cols-1 xsmall:grid-cols-2 medium:grid-cols-3 gap-3">
              {[
                { icon: HandMetal, title: "Handcrafted", desc: "Made by master artisans" },
                { icon: Droplets, title: "Hypoallergenic", desc: "Safe for sensitive skin" },
                { icon: Shield, title: "Tarnish Resistant", desc: "Long-lasting shine" },
                { icon: Leaf, title: "Sustainable", desc: "Ethically sourced silver" },
                { icon: Sparkles, title: "Premium Finish", desc: "Rhodium plated" },
                { icon: Gem, title: "Certified", desc: "BIS 925 hallmarked" },
              ].map((f, i) => (
                <FeatureCard key={f.title} {...f} delay={i * 0.06} />
              ))}
            </div>
          </section>

        </div>

        {/* Artisanal story + badges */}
        <div className="grid grid-cols-1 medium:grid-cols-2 gap-6">
          {/* Designer quote card — contrasted premium styling */}
          <motion.div
            className="relative overflow-hidden rounded-2xl border-l-4 border-[var(--color-gold)]"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {/* Contrasted deep plum gradient bg */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-plum)] to-[var(--color-plum-deep)]" />
            <div className="relative p-8">
              {/* Decorative quote mark */}
              <span className="block font-wittgenstein text-[48px] leading-none text-[var(--color-gold)] opacity-30 mb-2">"</span>
              <h3 className="font-wittgenstein text-[20px] font-semibold text-white mb-4">
                The Artisanal Story
              </h3>
              <p className="text-[15px] leading-[1.7] text-white/80 italic mb-5">
                "Each piece is designed to feel like it was crafted just for you — delicate yet enduring, modern yet timeless."
              </p>
              <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-gold)]">
                — Delfee Design Studio
              </span>
            </div>
          </motion.div>

          {/* Sustainability badges */}
          <div className="space-y-3">
            {[
              { icon: Leaf, title: "Sustainably Sourced", desc: "100% recycled silver", delay: 0.1 },
              { icon: History, title: "Heritage Craft", desc: "Handcrafted in India", delay: 0.2 },
            ].map(({ icon: Icon, title, desc, delay }) => (
              <motion.div
                key={title}
                className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay }}
              >
                <Icon size={20} strokeWidth={1.5} className="text-[var(--color-gold)] shrink-0" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.05em] text-[var(--color-text-primary)]">{title}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Specs table — full width */}
      <section className="mt-12 bg-white p-8 rounded-2xl shadow-sm border border-[var(--color-lavender)]/50">
        <h3 className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--color-plum)] mb-6">
          Product Details & Specifications
        </h3>
        <ul>
          {specs.map(({ label, value }) => (
            <SpecRow key={label} label={label} value={value} />
          ))}
        </ul>
      </section>
    </motion.div>
  )
}
