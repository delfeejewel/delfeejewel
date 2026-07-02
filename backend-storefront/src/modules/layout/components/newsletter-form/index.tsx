"use client"

import { useState } from "react"

const BACKEND =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

/**
 * Footer newsletter signup. Posts to the backend single-opt-in subscribe route.
 * Uses NEXT_PUBLIC envs (available client-side) + the publishable key the
 * /store route requires. Styling mirrors the original static markup.
 */
const NewsletterForm = () => {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [message, setMessage] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || state === "loading") return
    setState("loading")
    setMessage("")
    try {
      const res = await fetch(`${BACKEND}/store/newsletter/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ email: email.trim(), source: "footer" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || "Couldn't subscribe. Please try again.")
      }
      setState("done")
      setMessage("Thanks — you're on the list!")
      setEmail("")
    } catch (err: any) {
      setState("error")
      setMessage(err?.message || "Something went wrong.")
    }
  }

  if (state === "done") {
    return (
      <p className="text-[13px] text-[var(--color-gold)] py-3" role="status">
        {message}
      </p>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          aria-label="Email address"
          className="flex-1 h-11 px-4 rounded-l-lg bg-white/[0.07] border border-white/[0.1] border-r-0 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--color-gold)]/40 transition-colors"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="h-11 px-6 rounded-r-lg text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-footer-bg-deep)] [background:var(--gradient-gold-btn)] transition-all duration-300 hover:brightness-110 shrink-0 disabled:opacity-60"
        >
          {state === "loading" ? "…" : "Subscribe"}
        </button>
      </div>
      {state === "error" && (
        <p className="text-[12px] text-red-300/80 mt-2" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}

export default NewsletterForm
