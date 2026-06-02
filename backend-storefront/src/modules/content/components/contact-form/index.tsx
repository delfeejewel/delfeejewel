"use client"

import { useState } from "react"
import { Send, CheckCircle2 } from "lucide-react"

import { sendContactMessage } from "@lib/data/contact"

const SUBJECTS = [
  "General Enquiry",
  "Order Support",
  "Returns & Exchange",
  "Product Question",
  "Wholesale / Partnership",
  "Other",
]

const inputCls =
  "w-full h-11 px-3.5 rounded-lg text-[14px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"

const labelCls =
  "text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block"

export default function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: SUBJECTS[0],
    message: "",
  })
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState("")

  const set =
    (key: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setError("")
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Please fill in your name, email and message.")
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setError("Please enter a valid email address.")
      return
    }

    setStatus("sending")
    const res = await sendContactMessage(form)
    if (res.success) {
      setStatus("sent")
    } else {
      setStatus("idle")
      setError(res.error || "Something went wrong. Please try again.")
    }
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-12 px-6 rounded-2xl bg-white border border-[var(--color-lavender)]">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <h3 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)]">
          Message Sent
        </h3>
        <p className="text-[14px] text-[var(--color-text-muted)] max-w-sm">
          Thank you for reaching out. Our team will get back to you within 24–48
          business hours.
        </p>
      </div>
    )
  }

  return (
    <form
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
            className={inputCls}
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
            className={inputCls}
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
          className={`${inputCls} h-auto py-3 resize-y`}
          placeholder="How can we help you?"
        />
      </div>

      {error && (
        <p className="mt-4 px-3 py-2 rounded-lg text-[13px] bg-red-50 text-red-600 border border-red-100">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-5 w-full xsmall:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[var(--color-gold)] text-[var(--color-plum-deep)] text-[12px] font-bold uppercase tracking-wider hover:brightness-105 active:scale-[0.98] disabled:opacity-50 transition-all"
      >
        <Send size={15} />
        {status === "sending" ? "Sending..." : "Send Message"}
      </button>
    </form>
  )
}
