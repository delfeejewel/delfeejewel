"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react"

import { requestPasswordReset, resetPassword } from "@lib/data/customer"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"

const emailSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
})
type EmailValues = z.infer<typeof emailSchema>

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirm_password: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  })
type ResetValues = z.infer<typeof resetSchema>

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const inputClass = (hasError: boolean) =>
  `w-full px-0 py-3.5 pr-8 bg-transparent border-0 border-b-2 transition-colors placeholder:text-[var(--color-text-muted)]/50 text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:ring-0 ${
    hasError
      ? "border-red-400 focus:border-red-500"
      : "border-[var(--color-border)] focus:border-[var(--color-plum)]"
  }`

const labelClass =
  "block text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]"

export default function ForgotPassword({ setCurrentView }: Props) {
  // Flow: enter email → confirm code + set new password → success.
  const [step, setStep] = useState<"email" | "reset" | "done">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const emailForm = useForm<EmailValues>({ resolver: zodResolver(emailSchema) })
  const resetForm = useForm<ResetValues>({ resolver: zodResolver(resetSchema) })

  // Step 1 — email a reset code. Always advances (the backend never reveals
  // whether the account exists), so the UI can't be used to probe for accounts.
  async function onRequest(values: EmailValues) {
    setServerError(null)
    const res = await requestPasswordReset(values.email)
    if (!res.success) {
      setServerError(res.error || "We couldn't send the code. Please try again.")
      return
    }
    setEmail(values.email)
    setCode("")
    setStep("reset")
  }

  // Step 2 — verify the code and set the new password.
  async function onReset(values: ResetValues) {
    if (code.length < 6) {
      setServerError("Enter the 6-digit code we emailed you.")
      return
    }
    setSubmitting(true)
    setServerError(null)
    const res = await resetPassword({ email, code, password: values.password })
    setSubmitting(false)
    if (!res.success) {
      setServerError(res.error || "We couldn't reset your password.")
      return
    }
    setStep("done")
  }

  async function resend() {
    setResending(true)
    setServerError(null)
    const res = await requestPasswordReset(email)
    setResending(false)
    if (!res.success) {
      setServerError(res.error || "We couldn't resend the code.")
    }
  }

  // ── Success ──
  if (step === "done") {
    return (
      <div className="w-full text-center" data-testid="forgot-password-success">
        <div className="mx-auto w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="font-wittgenstein text-[22px] font-bold text-[var(--color-plum)]">
          Password updated
        </h2>
        <p className="text-[13px] text-[var(--color-text-muted)] mt-1.5">
          Your password has been reset. You can now sign in with it.
        </p>
        <button
          type="button"
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className="w-full py-4 mt-6 bg-[var(--color-gold)] text-[var(--color-plum-deep)] font-bold text-[11px] uppercase tracking-widest rounded-lg shadow-md hover:bg-[var(--color-gold-light)] transition-all active:scale-[0.98]"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  // ── Step 2: code + new password ──
  if (step === "reset") {
    return (
      <div className="w-full" data-testid="forgot-password-reset">
        <button
          type="button"
          onClick={() => {
            setStep("email")
            setServerError(null)
          }}
          className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-plum)] transition-colors mb-5"
        >
          ← Back
        </button>
        <p className="text-[13px] text-[var(--color-text-muted)] mb-6">
          Enter the 6-digit code we sent to{" "}
          <span className="font-semibold text-[var(--color-text-secondary)]">
            {email}
          </span>{" "}
          and choose a new password.
        </p>

        <form
          className="w-full space-y-5"
          onSubmit={resetForm.handleSubmit(onReset)}
          noValidate
        >
          {/* Code */}
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="000000"
            className="w-full px-4 py-3.5 rounded-lg border-2 border-[var(--color-border)] bg-white text-[22px] tracking-[10px] text-center font-mono text-[var(--color-text-primary)] placeholder:tracking-normal placeholder:text-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-plum)] transition-colors"
          />

          {/* New password */}
          <div className="space-y-1.5">
            <label htmlFor="reset-password" className={labelClass}>
              New Password
            </label>
            <div className="relative">
              <input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                {...resetForm.register("password")}
                className={inputClass(!!resetForm.formState.errors.password)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {resetForm.formState.errors.password && (
              <p className="text-[11px] text-red-500">
                {resetForm.formState.errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label htmlFor="reset-confirm" className={labelClass}>
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="reset-confirm"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter password"
                {...resetForm.register("confirm_password")}
                className={inputClass(
                  !!resetForm.formState.errors.confirm_password
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {resetForm.formState.errors.confirm_password && (
              <p className="text-[11px] text-red-500">
                {resetForm.formState.errors.confirm_password.message}
              </p>
            )}
          </div>

          {serverError && (
            <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || code.length < 6}
            className="w-full py-4 mt-1 bg-[var(--color-gold)] text-[var(--color-plum-deep)] font-bold text-[11px] uppercase tracking-widest rounded-lg shadow-md hover:bg-[var(--color-gold-light)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            data-testid="reset-password-button"
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset Password"
            )}
          </button>
        </form>

        <p className="text-center text-[12px] text-[var(--color-text-muted)] mt-4">
          Didn&apos;t get it?{" "}
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="font-semibold text-[var(--color-plum)] hover:underline disabled:opacity-60"
          >
            {resending ? "Sending..." : "Resend code"}
          </button>
        </p>
      </div>
    )
  }

  // ── Step 1: email ──
  return (
    <div className="w-full" data-testid="forgot-password-page">
      <form
        className="w-full space-y-6"
        onSubmit={emailForm.handleSubmit(onRequest)}
        noValidate
      >
        <div className="space-y-1.5">
          <label htmlFor="forgot-email" className={labelClass}>
            Email Address
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            {...emailForm.register("email")}
            className={inputClass(!!emailForm.formState.errors.email)}
          />
          {emailForm.formState.errors.email && (
            <p className="text-[11px] text-red-500 mt-1">
              {emailForm.formState.errors.email.message}
            </p>
          )}
        </div>

        {serverError && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={emailForm.formState.isSubmitting}
          className="w-full py-4 mt-2 bg-[var(--color-gold)] text-[var(--color-plum-deep)] font-bold text-[11px] uppercase tracking-widest rounded-lg shadow-md hover:bg-[var(--color-gold-light)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          data-testid="send-reset-code-button"
        >
          {emailForm.formState.isSubmitting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Sending code...
            </>
          ) : (
            "Send reset code"
          )}
        </button>
      </form>

      <div className="relative my-7 flex items-center">
        <div className="flex-grow border-t border-[var(--color-border)]" />
        <span className="flex-shrink mx-4 text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest">
          Or
        </span>
        <div className="flex-grow border-t border-[var(--color-border)]" />
      </div>

      <p className="text-center text-[13px] text-[var(--color-text-muted)]">
        Remembered it?{" "}
        <button
          type="button"
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className="font-semibold text-[var(--color-plum)] hover:underline underline-offset-2 transition-colors"
        >
          Sign in
        </button>
      </p>
    </div>
  )
}
