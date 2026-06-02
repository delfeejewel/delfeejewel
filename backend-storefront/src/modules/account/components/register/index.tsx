"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { signupAction } from "@lib/data/customer"
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const result = await signupAction({
      email: values.email,
      password: values.password,
      first_name: values.first_name,
      last_name: values.last_name,
      phone: values.phone || undefined,
    })
    if (result.error) {
      setServerError(result.error)
      return
    }
    router.refresh()
  }

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
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 mt-2 bg-[var(--color-gold)] text-[var(--color-plum-deep)] font-bold text-[11px] uppercase tracking-widest rounded-lg shadow-md hover:bg-[var(--color-gold-light)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          data-testid="register-button"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Creating account...
            </>
          ) : (
            "Create Account"
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
