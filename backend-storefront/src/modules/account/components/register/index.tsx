"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { CheckCircle2, Eye, EyeOff, Loader2, PackageCheck } from "lucide-react"

import { requestSignupOtp, signupWithOtp } from "@lib/data/customer"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"

const schema = z
  .object({
    first_name: z.string().min(1, "First name is required").max(50),
    last_name: z.string().min(1, "Last name is required").max(50),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    phone: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^[+\d\s\-().]{7,20}$/.test(val),
        "Enter a valid phone number"
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirm_password: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  })

type FormValues = z.infer<typeof schema>

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

type FieldName = keyof FormValues

function InputField({
  id,
  label,
  type = "text",
  placeholder,
  autoComplete,
  optional,
  error,
  showToggle,
  onToggle,
  showValue,
  registration,
}: {
  id: string
  label: string
  type?: string
  placeholder?: string
  autoComplete?: string
  optional?: boolean
  error?: string
  showToggle?: boolean
  onToggle?: () => void
  showValue?: boolean
  registration: ReturnType<ReturnType<typeof useForm<FormValues>>["register"]>
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]"
      >
        {label}
        {optional && (
          <span className="ml-1 normal-case font-normal tracking-normal text-[var(--color-text-muted)]">
            (optional)
          </span>
        )}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showToggle ? (showValue ? "text" : "password") : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          {...registration}
          className={`w-full px-0 py-3.5 bg-transparent border-0 border-b-2 transition-colors placeholder:text-[var(--color-text-muted)]/50 text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:ring-0 ${
            showToggle ? "pr-8" : ""
          } ${
            error
              ? "border-red-400 focus:border-red-500"
              : "border-[var(--color-border)] focus:border-[var(--color-plum)]"
          }`}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            {showValue ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
}

export default function Register({ setCurrentView }: Props) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Flow: collect details → confirm the emailed OTP code → success.
  const [step, setStep] = useState<"details" | "code" | "done">("details")
  const [details, setDetails] = useState<FormValues | null>(null)
  const [code, setCode] = useState("")
  const [creating, setCreating] = useState(false)
  const [resending, setResending] = useState(false)
  const [linkedOrders, setLinkedOrders] = useState(0)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  // Step 1 — validate details, then email a verification code.
  async function onSubmit(values: FormValues) {
    setServerError(null)
    const res = await requestSignupOtp(values.email)
    if (!res.success) {
      setServerError(res.error || "We couldn't send the code. Please try again.")
      return
    }
    setDetails(values)
    setCode("")
    setStep("code")
  }

  // Step 2 — verify the code: creates the account, links guest orders, signs in.
  async function submitCode() {
    if (!details || code.length < 6) return
    setCreating(true)
    setServerError(null)
    const res = await signupWithOtp({
      email: details.email,
      password: details.password,
      first_name: details.first_name,
      last_name: details.last_name,
      phone: details.phone || undefined,
      code,
    })
    setCreating(false)
    if (!res.success) {
      setServerError(res.error || "We couldn't create your account.")
      return
    }
    setLinkedOrders(res.linked_orders ?? 0)
    setStep("done")
  }

  async function resend() {
    if (!details) return
    setResending(true)
    setServerError(null)
    const res = await requestSignupOtp(details.email)
    setResending(false)
    if (!res.success) {
      setServerError(res.error || "We couldn't resend the code.")
    }
  }

  const accountExists = !!serverError && /exist/i.test(serverError)

  // ── Success ──
  if (step === "done") {
    return (
      <div className="w-full text-center" data-testid="register-success">
        <div className="mx-auto w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="font-wittgenstein text-[22px] font-bold text-[var(--color-plum)]">
          You&apos;re all set!
        </h2>
        <p className="text-[13px] text-[var(--color-text-muted)] mt-1.5">
          Your account has been created and you&apos;re signed in.
        </p>

        {linkedOrders > 0 && (
          <div className="mt-5 flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg bg-[var(--color-lavender)]/40 border border-[var(--color-lavender)] text-[13px] text-[var(--color-plum)]">
            <PackageCheck size={17} className="shrink-0" />
            <span>
              We added{" "}
              <strong>
                {linkedOrders} past order{linkedOrders === 1 ? "" : "s"}
              </strong>{" "}
              to your account.
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => router.refresh()}
          className="w-full py-4 mt-6 bg-[var(--color-gold)] text-[var(--color-plum-deep)] font-bold text-[11px] uppercase tracking-widest rounded-lg shadow-md hover:bg-[var(--color-gold-light)] transition-all active:scale-[0.98]"
        >
          Continue to my account
        </button>
      </div>
    )
  }

  // ── Step 2: verification code ──
  if (step === "code" && details) {
    return (
      <div className="w-full" data-testid="register-otp">
        <button
          type="button"
          onClick={() => {
            setStep("details")
            setServerError(null)
          }}
          className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-plum)] transition-colors mb-5"
        >
          ← Back
        </button>
        <h2 className="font-wittgenstein text-[20px] font-bold text-[var(--color-plum)]">
          Verify your email
        </h2>
        <p className="text-[13px] text-[var(--color-text-muted)] mt-1 mb-6">
          Enter the 6-digit code we sent to{" "}
          <span className="font-semibold text-[var(--color-text-secondary)]">
            {details.email}
          </span>
          .
        </p>

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

        {serverError && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">
            {serverError}
            {accountExists && (
              <button
                type="button"
                onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
                className="ml-1 font-semibold underline underline-offset-2"
              >
                Sign in
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={submitCode}
          disabled={creating || code.length < 6}
          className="w-full py-4 mt-5 bg-[var(--color-gold)] text-[var(--color-plum-deep)] font-bold text-[11px] uppercase tracking-widest rounded-lg shadow-md hover:bg-[var(--color-gold-light)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          data-testid="register-verify-button"
        >
          {creating ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </button>

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

  // ── Step 1: details ──
  return (
    <div className="w-full" data-testid="register-page">
      <form className="w-full space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>

        {/* Name row */}
        <div className="grid grid-cols-2 gap-4">
          <InputField
            id="reg-first-name"
            label="First Name"
            placeholder="First name"
            autoComplete="given-name"
            error={errors.first_name?.message}
            registration={register("first_name")}
          />
          <InputField
            id="reg-last-name"
            label="Last Name"
            placeholder="Last name"
            autoComplete="family-name"
            error={errors.last_name?.message}
            registration={register("last_name")}
          />
        </div>

        <InputField
          id="reg-email"
          label="Email Address"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          error={errors.email?.message}
          registration={register("email")}
        />

        <InputField
          id="reg-phone"
          label="Phone Number"
          type="tel"
          placeholder="+91 98765 43210"
          autoComplete="tel"
          optional
          error={errors.phone?.message}
          registration={register("phone")}
        />

        <InputField
          id="reg-password"
          label="Password"
          type="password"
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          autoComplete="new-password"
          showToggle
          showValue={showPassword}
          onToggle={() => setShowPassword(!showPassword)}
          error={errors.password?.message}
          registration={register("password")}
        />

        <InputField
          id="reg-confirm"
          label="Confirm Password"
          type="password"
          placeholder="Re-enter password"
          autoComplete="new-password"
          showToggle
          showValue={showConfirm}
          onToggle={() => setShowConfirm(!showConfirm)}
          error={errors.confirm_password?.message}
          registration={register("confirm_password")}
        />

        {/* Server error */}
        {serverError && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">
            {serverError}
            {accountExists && (
              <button
                type="button"
                onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
                className="ml-1 font-semibold underline underline-offset-2"
              >
                Sign in
              </button>
            )}
          </div>
        )}

        {/* Submit — sends the email verification code */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 mt-2 bg-[var(--color-gold)] text-[var(--color-plum-deep)] font-bold text-[11px] uppercase tracking-widest rounded-lg shadow-md hover:bg-[var(--color-gold-light)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          data-testid="register-button"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Sending code...
            </>
          ) : (
            "Continue"
          )}
        </button>
      </form>

      {/* Divider + switch */}
      <div className="relative my-7 flex items-center">
        <div className="flex-grow border-t border-[var(--color-border)]" />
        <span className="flex-shrink mx-4 text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest">
          Or
        </span>
        <div className="flex-grow border-t border-[var(--color-border)]" />
      </div>

      <p className="text-center text-[13px] text-[var(--color-text-muted)]">
        Already have an account?{" "}
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
