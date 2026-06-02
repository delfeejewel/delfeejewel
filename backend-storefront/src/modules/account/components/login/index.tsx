"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { loginAction } from "@lib/data/customer"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type FormValues = z.infer<typeof schema>

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

export default function Login({ setCurrentView }: Props) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
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
    const result = await loginAction(values.email, values.password)
    if (result.error) {
      setServerError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="w-full" data-testid="login-page">
      <form className="w-full space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>

        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="block text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]"
          >
            Email Address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            {...register("email")}
            className={`w-full px-0 py-3.5 bg-transparent border-0 border-b-2 transition-colors placeholder:text-[var(--color-text-muted)]/50 text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:ring-0 ${
              errors.email
                ? "border-red-400 focus:border-red-500"
                : "border-[var(--color-border)] focus:border-[var(--color-plum)]"
            }`}
            data-testid="email-input"
          />
          {errors.email && (
            <p className="text-[11px] text-red-500 mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label
              htmlFor="login-password"
              className="block text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]"
            >
              Password
            </label>
            <a
              href="#"
              className="text-[11px] text-[var(--color-plum)] hover:underline underline-offset-2 transition-colors"
            >
              Forgot?
            </a>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
              className={`w-full px-0 py-3.5 pr-8 bg-transparent border-0 border-b-2 transition-colors placeholder:text-[var(--color-text-muted)]/50 text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:ring-0 ${
                errors.password
                  ? "border-red-400 focus:border-red-500"
                  : "border-[var(--color-border)] focus:border-[var(--color-plum)]"
              }`}
              data-testid="password-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-[11px] text-red-500 mt-1">{errors.password.message}</p>
          )}
        </div>

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
          data-testid="sign-in-button"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
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
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          className="font-semibold text-[var(--color-plum)] hover:underline underline-offset-2 transition-colors"
          data-testid="register-button"
        >
          Create one
        </button>
      </p>
    </div>
  )
}
