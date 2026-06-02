"use client"

import { ShieldCheck, Truck, RotateCcw, Award } from "lucide-react"
import { motion } from "framer-motion"

const badges = [
  { icon: ShieldCheck, label: "925 Certified Silver" },
  { icon: Truck, label: "Free Shipping" },
  { icon: RotateCcw, label: "Easy Returns" },
  { icon: Award, label: "Quality Assured" },
]

export default function TrustBadges() {
  return (
    <div
      className="flex items-center justify-center gap-6 small:gap-10 py-5 mt-10 overflow-x-auto no-scrollbar"
      style={{
        borderTop: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
        marginLeft: "calc(-50vw + 50%)",
        marginRight: "calc(-50vw + 50%)",
        paddingLeft: "5vw",
        paddingRight: "5vw",
        background: "var(--color-bg-secondary)",
      }}
    >
      {badges.map(({ icon: Icon, label }, i) => (
        <motion.div
          key={label}
          className="flex items-center gap-2 flex-shrink-0 cursor-default"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
          whileHover={{ y: -2 }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "var(--color-lavender)" }}
          >
            <Icon size={14} strokeWidth={1.5} style={{ color: "var(--color-plum)" }} />
          </div>
          <span className="text-[12px] font-medium whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
            {label}
          </span>
        </motion.div>
      ))}
    </div>
  )
}
