"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import Register from "@modules/account/components/register"
import Login from "@modules/account/components/login"
import ForgotPassword from "@modules/account/components/forgot-password"

export enum LOGIN_VIEW {
  SIGN_IN = "sign-in",
  REGISTER = "register",
  FORGOT_PASSWORD = "forgot-password",
}

/* ─── Jewellery decorative icons — same style as footer FloatingIcons ─── */
function BackgroundIcons() {
  const plum = "var(--color-plum)"
  const gold = "var(--color-gold)"

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Diamond — top left */}
      <svg
        className="absolute top-12 left-[8%] w-20 h-20 opacity-[0.06]"
        style={{ animation: "float 7s ease-in-out infinite" }}
        viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={0.6}
      >
        <path d="M2.5 9h19l-9.5 13L2.5 9zM2.5 9l4-5h11l4 5M7.5 4l4.5 5 4.5-5M12 9v13" />
      </svg>

      {/* Ring — top right */}
      <svg
        className="absolute top-16 right-[10%] w-24 h-24 opacity-[0.05]"
        style={{ animation: "float 9s ease-in-out infinite 1s" }}
        viewBox="0 0 24 24" fill="none" stroke={plum} strokeWidth={0.5}
      >
        <circle cx="12" cy="14" r="8" />
        <ellipse cx="12" cy="14" rx="4" ry="8" />
        <path d="M8 6.5c1-1.5 2.5-2.5 4-2.5s3 1 4 2.5" />
      </svg>

      {/* Crown — bottom left */}
      <svg
        className="absolute bottom-24 left-[10%] w-20 h-20 opacity-[0.06]"
        style={{ animation: "float 8s ease-in-out infinite 2s" }}
        viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={0.6}
      >
        <path d="M2 20h20M4 20l1-12 4 5 3-9 3 9 4-5 1 12" />
      </svg>

      {/* Gem — bottom right */}
      <svg
        className="absolute bottom-14 right-[12%] w-16 h-16 opacity-[0.07]"
        style={{ animation: "float 6s ease-in-out infinite 0.5s" }}
        viewBox="0 0 24 24" fill="none" stroke={plum} strokeWidth={0.6}
      >
        <polygon points="12,2 22,8.5 17,22 7,22 2,8.5" />
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="8.5" x2="22" y2="8.5" />
      </svg>

      {/* Sparkle star — mid left */}
      <svg
        className="absolute top-[44%] left-[4%] w-12 h-12 opacity-[0.08]"
        style={{ animation: "float 5s ease-in-out infinite 1.5s" }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z" />
      </svg>

      {/* Pearl cluster — mid right */}
      <svg
        className="absolute top-[32%] right-[4%] w-16 h-16 opacity-[0.05]"
        style={{ animation: "float 10s ease-in-out infinite 3s" }}
        viewBox="0 0 24 24" fill={plum}
      >
        <circle cx="12" cy="12" r="5" />
        <circle cx="6" cy="8" r="2.5" />
        <circle cx="18" cy="8" r="2.5" />
        <circle cx="8" cy="18" r="2" />
        <circle cx="16" cy="18" r="2" />
      </svg>

      {/* Earring — top center-right */}
      <svg
        className="absolute top-10 left-[55%] w-12 h-12 opacity-[0.06]"
        style={{ animation: "float 8.5s ease-in-out infinite 2.5s" }}
        viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth={0.6}
      >
        <path d="M12 2v6" />
        <circle cx="12" cy="14" r="6" />
        <circle cx="12" cy="14" r="2" fill={gold} fillOpacity={0.2} />
        <path d="M12 20v2" />
      </svg>

      {/* Small sparkles scattered */}
      <svg
        className="absolute top-[65%] right-[28%] w-8 h-8 opacity-[0.09]"
        style={{ animation: "float 4.5s ease-in-out infinite 1s" }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
      <svg
        className="absolute top-[22%] left-[30%] w-6 h-6 opacity-[0.07]"
        style={{ animation: "float 6s ease-in-out infinite 0.8s" }}
        viewBox="0 0 24 24" fill={plum}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>
      <svg
        className="absolute bottom-[32%] right-[40%] w-10 h-10 opacity-[0.05]"
        style={{ animation: "float 7.5s ease-in-out infinite 3.5s" }}
        viewBox="0 0 24 24" fill={gold}
      >
        <path d="M12 0l1.5 10.5L24 12l-10.5 1.5L12 24l-1.5-10.5L0 12l10.5-1.5z" />
      </svg>

      {/* Gradient glow orbs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[var(--color-gold)]/[0.05] blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-[var(--color-plum)]/[0.04] blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-[var(--color-lavender)]/30 blur-[100px]" />
    </div>
  )
}

/* ─── Login Template ─────────────────────────────────────── */

export default function LoginTemplate() {
  const [currentView, setCurrentView] = useState<LOGIN_VIEW>(LOGIN_VIEW.SIGN_IN)

  const isForgot = currentView === LOGIN_VIEW.FORGOT_PASSWORD

  const heading = isForgot
    ? "Reset Password"
    : currentView === LOGIN_VIEW.SIGN_IN
    ? "Welcome Back"
    : "Create Account"

  const subtitle = isForgot
    ? "We'll email you a code to reset your password."
    : currentView === LOGIN_VIEW.SIGN_IN
    ? "Sign in to continue your curated journey."
    : "Join us for an elevated jewellery experience."

  return (
    <div className="w-full font-outfit relative flex items-center justify-center py-10 small:py-16 overflow-hidden min-h-[560px]">

      <BackgroundIcons />

      {/* Form card */}
      <div className="relative z-10 w-full max-w-[420px] bg-white rounded-2xl shadow-[0_20px_48px_rgba(79,50,103,0.10)] border border-[var(--color-lavender)] px-8 small:px-10 py-10">

        {/* Heading */}
        <div className="mb-8 text-center">
          <h2 className="font-wittgenstein text-[28px] font-semibold text-[var(--color-plum)] leading-tight">
            {heading}
          </h2>
          <p className="text-[var(--color-text-muted)] text-[13px] mt-1.5 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Pill toggle — hidden on the forgot-password view */}
        <div
          className={`flex p-1 bg-[var(--color-bg-secondary)] rounded-lg mb-8 ${
            isForgot ? "hidden" : ""
          }`}
        >
          <button
            onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
            className={`flex-1 py-2.5 px-3 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all duration-200 ${
              currentView === LOGIN_VIEW.SIGN_IN
                ? "bg-white text-[var(--color-text-primary)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
            className={`flex-1 py-2.5 px-3 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all duration-200 ${
              currentView === LOGIN_VIEW.REGISTER
                ? "bg-white text-[var(--color-text-primary)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {currentView === LOGIN_VIEW.SIGN_IN ? (
              <Login setCurrentView={setCurrentView} />
            ) : currentView === LOGIN_VIEW.REGISTER ? (
              <Register setCurrentView={setCurrentView} />
            ) : (
              <ForgotPassword setCurrentView={setCurrentView} />
            )}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  )
}
