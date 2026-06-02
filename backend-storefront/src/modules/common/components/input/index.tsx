import React, { useEffect, useImperativeHandle, useState } from "react"

import Eye from "@modules/common/icons/eye"
import EyeOff from "@modules/common/icons/eye-off"

type InputProps = Omit<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
  "placeholder"
> & {
  label: string
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
  name: string
  topLabel?: string
}

/**
 * Branded floating-label input. Default project input across all forms
 * (checkout, account, login, contact). Plum focus ring, lavender border,
 * matches the site's CTA + card design language.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ type, name, label, required, topLabel, className = "", ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [inputType, setInputType] = useState(type)

    useEffect(() => {
      if (type === "password" && showPassword) setInputType("text")
      if (type === "password" && !showPassword) setInputType("password")
    }, [type, showPassword])

    useImperativeHandle(ref, () => inputRef.current!)

    return (
      <div className={`flex flex-col w-full ${className}`}>
        {topLabel && (
          <label className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
            {topLabel}
          </label>
        )}
        <div className="relative w-full">
          <input
            id={name}
            type={inputType}
            name={name}
            placeholder=" "
            required={required}
            className="peer w-full h-12 pt-4 pb-1 px-3.5 text-[14px] bg-white text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-xl appearance-none transition-colors duration-150 outline-none hover:border-[var(--color-border-hover)] focus:border-[var(--color-plum)] focus:ring-2 focus:ring-[var(--color-plum)]/15"
            {...props}
            ref={inputRef}
          />
          <label
            htmlFor={name}
            onClick={() => inputRef.current?.focus()}
            className="absolute left-3.5 top-3.5 text-[14px] text-[var(--color-text-muted)] origin-[0_0] transition-all duration-150 pointer-events-none peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-2 peer-focus:scale-75 peer-focus:text-[var(--color-plum)] peer-[:not(:placeholder-shown)]:-translate-y-2 peer-[:not(:placeholder-shown)]:scale-75"
          >
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          {type === "password" && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-plum)] transition-colors p-1"
            >
              {showPassword ? <Eye /> : <EyeOff />}
            </button>
          )}
        </div>
      </div>
    )
  }
)

Input.displayName = "Input"

export default Input
