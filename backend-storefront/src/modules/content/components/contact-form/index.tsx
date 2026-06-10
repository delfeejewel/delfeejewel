"use client"

import { useState } from "react"
import { Send, CheckCircle2, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast, Toaster } from "@medusajs/ui"

import { sendContactMessage } from "@lib/data/contact"

const DEFAULT_SUBJECTS = [
  "General Enquiry",
  "Order Support",
  "Returns & Exchange",
  "Product Question",
  "Other",
]

type ContactFormProps = {
  subjects?: string[]
  submitLabel?: string
  successTitle?: string
  successMessage?: string
}

const inputCls =
  "w-full h-11 px-4 rounded-lg text-[14px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"

const labelCls =
  "text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block"

export default function ContactForm({
  subjects,
  submitLabel = "Send Message",
  successTitle = "Message Sent",
  successMessage = "Thank you for reaching out. Our team will get back to you within 24–48 business hours.",
}: ContactFormProps = {}) {
  const SUBJECTS = subjects?.length ? subjects : DEFAULT_SUBJECTS
  const emptyForm = {
    name: "",
    email: "",
    phone: "",
    subject: SUBJECTS[0],
    message: "",
  }
  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle")
  const [invalid, setInvalid] = useState<Record<string, boolean>>({})

  const set =
    (key: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setInvalid((v) => (v[key] ? { ...v, [key]: false } : v))
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const missing = {
      name: !form.name.trim(),
      email: !form.email.trim(),
      message: !form.message.trim(),
    }
    if (missing.name || missing.email || missing.message) {
      setInvalid(missing)
      toast.error("Please fill in your name, email and message.")
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setInvalid({ email: true })
      toast.error("Please enter a valid email address.")
      return
    }

    setStatus("sending")
    const res = await sendContactMessage(form)
    if (res.success) {
      setStatus("sent")
    } else {
      setStatus("idle")
      toast.error(res.error || "Something went wrong. Please try again.")
    }
  }

  const reset = () => {
    setForm(emptyForm)
    setInvalid({})
    setStatus("idle")
  }

  const fieldCls = (key: string) =>
    `${inputCls} ${invalid[key] ? "border-red-400 ring-1 ring-red-200" : ""}`

  return (
    <>
      <Toaster />
      <AnimatePresence mode="wait">
        {status === "sent" ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col items-center text-center gap-3 py-12 px-6 rounded-2xl bg-white border border-[var(--color-lavender)]"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center"
            >
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </motion.div>
            <h3 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)]">
              {successTitle}
            </h3>
            <p className="text-[14px] text-[var(--color-text-muted)] max-w-sm">
              {successMessage}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-2 text-[13px] font-semibold text-[var(--color-plum)] underline underline-offset-4 hover:text-[var(--color-gold)] transition-colors"
            >
              Send another message
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onSubmit={handleSubmit}
            className="rounded-2xl bg-white border border-[var(--color-lavender)] p-6 small:p-8"
            noValidate
          >
            <div className="grid grid-cols-1 xsmall:grid-cols-2 gap-4">
              <div>
                <label className={labelCls} htmlFor="cf-name">
                  Full Name *
                </label>
                <input
                  id="cf-name"
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  className={fieldCls("name")}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="cf-email">
                  Email Address *
                </label>
                <input
                  id="cf-email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  className={fieldCls("email")}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="cf-phone">
                  Phone Number
                </label>
                <input
                  id="cf-phone"
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  className={inputCls}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="cf-subject">
                  Subject
                </label>
                <select
                  id="cf-subject"
                  value={form.subject}
                  onChange={set("subject")}
                  className={`${inputCls} cursor-pointer`}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className={labelCls} htmlFor="cf-message">
                Message *
              </label>
              <textarea
                id="cf-message"
                value={form.message}
                onChange={set("message")}
                rows={5}
                maxLength={2000}
                className={`${fieldCls("message")} h-auto py-3 resize-y`}
                placeholder="How can we help you?"
              />
            </div>

            <motion.button
              type="submit"
              disabled={status === "sending"}
              whileTap={{ scale: 0.97 }}
              className="mt-5 w-full xsmall:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {status === "sending" ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send size={15} />
                  {submitLabel}
                </>
              )}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>
    </>
  )
}
