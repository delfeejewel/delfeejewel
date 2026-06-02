"use client"

import { useActionState, useState } from "react"
import { signupFromOrder } from "@lib/data/customer"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Eye, EyeOff, Loader2, CheckCircle } from "lucide-react"

type GuestOnboardingPromptProps = {
  order: any
}

export default function GuestOnboardingPrompt({
  order,
}: GuestOnboardingPromptProps) {
  const [result, formAction, isPending] = useActionState(signupFromOrder, null)
  const [dismissed, setDismissed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const email = order.email || ""
  const firstName = order.shipping_address?.first_name || ""
  const lastName = order.shipping_address?.last_name || ""
  const phone = order.shipping_address?.phone || ""

  if (dismissed) {
    return null
  }

  if (result === "success") {
    return (
      <div className="bg-white rounded-2xl border border-[var(--color-lavender)] overflow-hidden shadow-sm w-full max-w-4xl">
        <div className="h-1 [background:linear-gradient(90deg,var(--color-gold),var(--color-plum),var(--color-gold))]" />
        <div className="p-6 small:p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle className="w-12 h-12 text-[var(--color-plum)]" />
          <h3 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-text-primary)]">
            Account Created!
          </h3>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            You can now track your orders and enjoy faster checkout.
          </p>
          <LocalizedClientLink
            href="/account"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-white text-sm font-medium [background:linear-gradient(135deg,var(--color-plum),var(--color-plum-deep))] hover:opacity-90 transition-opacity"
          >
            Go to My Account
          </LocalizedClientLink>
        </div>
      </div>
    )
  }

  const hasError = result && result !== "success"

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-lavender)] overflow-hidden shadow-sm w-full max-w-4xl">
      <div className="h-1 [background:linear-gradient(90deg,var(--color-gold),var(--color-plum),var(--color-gold))]" />
      <div className="p-6 small:p-8">
        <h3 className="font-wittgenstein text-[20px] font-semibold text-[var(--color-text-primary)] mb-1">
          Create Your Account
        </h3>
        <p className="text-[13px] text-[var(--color-text-muted)] mb-6">
          Set a password to track orders and enjoy faster checkout.
        </p>

        {hasError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {result}
          </div>
        )}

        <form action={formAction}>
          {/* Hidden fields */}
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="first_name" value={firstName} />
          <input type="hidden" name="last_name" value={lastName} />
          <input type="hidden" name="phone" value={phone} />

          {/* Pre-filled info display */}
          <div className="grid grid-cols-1 small:grid-cols-2 gap-4 mb-6">
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
                Name
              </span>
              <span className="text-sm text-[var(--color-text-primary)]">
                {firstName} {lastName}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
                Email
              </span>
              <span className="text-sm text-[var(--color-text-primary)]">
                {email}
              </span>
            </div>
            {phone && (
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
                  Phone
                </span>
                <span className="text-sm text-[var(--color-text-primary)]">
                  {phone}
                </span>
              </div>
            )}
          </div>

          {/* Password input */}
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5"
            >
              Set a Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-lavender)] bg-white text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-plum)]/20 focus:border-[var(--color-plum)] transition-colors font-outfit"
                placeholder="Minimum 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-white text-sm font-medium [background:linear-gradient(135deg,var(--color-plum),var(--color-plum-deep))] hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
