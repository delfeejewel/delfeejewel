import { ArrowRight, UserRound } from "lucide-react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

const SignInPrompt = () => {
  return (
    <div className="flex flex-col xsmall:flex-row items-start xsmall:items-center justify-between gap-4 rounded-2xl bg-[var(--color-lavender)] border border-[var(--color-plum-light)] p-4 small:p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 border border-[var(--color-plum-light)]">
          <UserRound size={18} strokeWidth={1.6} className="text-[var(--color-plum)]" />
        </div>
        <div>
          <p className="font-wittgenstein text-[16px] font-semibold text-[var(--color-plum)] leading-tight">
            Already have an account?
          </p>
          <p className="text-[12.5px] text-[var(--color-text-secondary)] mt-0.5">
            Sign in to use your saved addresses and reorder faster.
          </p>
        </div>
      </div>
      <LocalizedClientLink
        href="/account"
        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-[11.5px] font-bold uppercase tracking-wider text-[var(--color-plum)] border-2 border-[var(--color-plum)] hover:bg-[var(--color-plum)] hover:text-white transition-all shrink-0"
        data-testid="sign-in-button"
      >
        Sign in
        <ArrowRight size={13} />
      </LocalizedClientLink>
    </div>
  )
}

export default SignInPrompt
