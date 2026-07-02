"use client"

import { useEffect, useState } from "react"
import { Calendar, Clock, CheckCircle2, Loader2 } from "lucide-react"
import { toast, Toaster } from "@medusajs/ui"

import {
  getBookingConfig,
  getAvailability,
  bookAppointment,
  type BookingConfig,
  type DaySlot,
} from "@lib/data/appointments"

const inputCls =
  "w-full h-11 px-4 rounded-lg text-[14px] outline-none border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30 transition-all"
const labelCls =
  "text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block"

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const addDays = (iso: string, days: number) =>
  new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10)

export default function AppointmentForm() {
  const [cfg, setCfg] = useState<BookingConfig | null>(null)
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    service_type: "",
    date: "",
    notes: "",
  })
  const [slots, setSlots] = useState<DaySlot[]>([])
  const [slot, setSlot] = useState("")
  const [slotMsg, setSlotMsg] = useState("")
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [status, setStatus] = useState<"idle" | "booking" | "done">("idle")
  const [reference, setReference] = useState("")

  useEffect(() => {
    getBookingConfig()
      .then((c) => {
        setCfg(c)
        setForm((f) => ({ ...f, service_type: c.service_types[0] || "" }))
      })
      .catch(() => {})
  }, [])

  // Load slots whenever the date changes.
  useEffect(() => {
    if (!form.date) {
      setSlots([])
      setSlot("")
      setSlotMsg("")
      return
    }
    setLoadingSlots(true)
    setSlot("")
    getAvailability(form.date)
      .then((d) => {
        setSlots(d.slots || [])
        setSlotMsg(d.open ? "" : d.reason || "No open slots on this date.")
      })
      .catch(() => setSlotMsg("Could not load times — please try again."))
      .finally(() => setLoadingSlots(false))
  }, [form.date])

  const set = (k: keyof typeof form) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Please fill in your name, email and phone.")
      return
    }
    if (!EMAIL_RE.test(form.email)) {
      toast.error("Please enter a valid email address.")
      return
    }
    if (!form.date || !slot) {
      toast.error("Please pick a date and time.")
      return
    }
    setStatus("booking")
    const res = await bookAppointment({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      service_type: form.service_type,
      date: form.date,
      slot,
      notes: form.notes.trim() || undefined,
    })
    if (res.success) {
      setReference(res.reference || "")
      setStatus("done")
    } else {
      setStatus("idle")
      setSlot("") // clear the (possibly now-gone) selection so the user re-picks
      toast.error(res.error || "Could not book. Please try again.")
      // a slot may have just filled — refresh availability
      if (form.date) getAvailability(form.date).then((d) => setSlots(d.slots || []))
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-12 px-6 rounded-2xl bg-white border border-[var(--color-lavender)]">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <h3 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-plum)]">
          Appointment booked
        </h3>
        <p className="text-[14px] text-[var(--color-text-muted)] max-w-sm">
          Your visit is confirmed for <strong>{form.date}</strong> at{" "}
          <strong>{slot}</strong>. We've emailed your confirmation
          {reference ? (
            <>
              {" "}
              — reference <strong>{reference}</strong>
            </>
          ) : null}
          . See you at our store!
        </p>
      </div>
    )
  }

  if (cfg && !cfg.enabled) {
    return (
      <div className="rounded-2xl bg-white border border-[var(--color-lavender)] p-8 text-center">
        <p className="text-[14px] text-[var(--color-text-muted)]">
          Online appointment booking is currently closed. Please contact us to
          arrange a visit.
        </p>
      </div>
    )
  }

  const maxDate = cfg ? addDays(cfg.today, cfg.horizon_days) : undefined

  return (
    <>
      <Toaster />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 small:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Full name *</label>
            <input className={inputCls} value={form.name} onChange={set("name")} placeholder="Your name" />
          </div>
          <div>
            <label className={labelCls}>Phone *</label>
            <input className={inputCls} value={form.phone} onChange={set("phone")} placeholder="+91…" />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input className={inputCls} type="email" value={form.email} onChange={set("email")} placeholder="you@email.com" />
          </div>
          <div>
            <label className={labelCls}>What's the visit for?</label>
            <select className={inputCls} value={form.service_type} onChange={set("service_type")}>
              {(cfg?.service_types || []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>
            <Calendar size={12} className="inline mr-1 -mt-0.5" />
            Preferred date *
          </label>
          <input
            className={inputCls}
            type="date"
            value={form.date}
            min={cfg?.today}
            max={maxDate}
            onChange={set("date")}
          />
        </div>

        {form.date && (
          <div>
            <label className={labelCls}>
              <Clock size={12} className="inline mr-1 -mt-0.5" />
              Choose a time *
            </label>
            {loadingSlots ? (
              <p className="text-[13px] text-[var(--color-text-muted)] flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading times…
              </p>
            ) : slots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    type="button"
                    key={s.time}
                    onClick={() => setSlot(s.time)}
                    className={`h-9 px-4 rounded-lg text-[13px] font-medium border transition-all ${
                      slot === s.time
                        ? "bg-[var(--color-plum)] text-white border-[var(--color-plum)]"
                        : "bg-white text-[var(--color-text-primary)] border-[var(--color-border)] hover:border-[var(--color-gold)]"
                    }`}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[var(--color-text-muted)]">
                {slotMsg || "No open slots on this date."}
              </p>
            )}
          </div>
        )}

        <div>
          <label className={labelCls}>Anything we should know? (optional)</label>
          <textarea
            className={`${inputCls} h-24 py-3 resize-none`}
            value={form.notes}
            onChange={set("notes")}
            placeholder="e.g. looking for an anniversary gift, ring size 12…"
          />
        </div>

        <button
          type="submit"
          disabled={status === "booking" || !slot}
          className="h-12 rounded-lg text-[13px] font-semibold uppercase tracking-[0.1em] text-white bg-[var(--color-plum)] hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {status === "booking" ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Booking…
            </>
          ) : (
            "Book appointment"
          )}
        </button>
      </form>
    </>
  )
}
