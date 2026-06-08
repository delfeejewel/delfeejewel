import { clx } from "@medusajs/ui"
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
  /** Static, non-editable adornment shown at the start of the field (e.g. "+91"). */
  prefix?: string
}

/**
 * Branded floating-label input. Default project input across all forms
 * (checkout, account, login, contact). Plum focus ring, lavender border,
 * matches the site's CTA + card design language.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { type, name, label, required, topLabel, prefix, className = "", ...props },
    ref
  ) => {
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
          {prefix && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-[var(--color-text-secondary)] pointer-events-none select-none">
              {prefix}
            </span>
          )}
          <input
            id={name}
            type={inputType}
            name={name}
            placeholder=" "
            required={required}
            className={clx(
              "peer w-full h-12 px-4 text-[14px] bg-white text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-xl appearance-none transition-colors duration-150 outline-none hover:border-[var(--color-border-hover)] focus:border-[var(--color-plum)] focus:ring-2 focus:ring-[var(--color-plum)]/15",
              prefix && "pl-12"
            )}
            {...props}
            ref={inputRef}
          />
          {/* Floating label: rests vertically-centered, then floats up to sit
              "notched" on the top border (white bg) on focus / when filled, so it
              never collides with the border edge. Prefixed fields stay floated. */}
          <label
            htmlFor={name}
            onClick={() => inputRef.current?.focus()}
            className={clx(
              "absolute left-2.5 -translate-y-1/2 px-1 text-[14px] text-[var(--color-text-muted)] transition-all duration-150 pointer-events-none",
              prefix
                ? "top-0 text-[11px] bg-white peer-focus:text-[var(--color-plum)]"
                : "top-1/2 bg-transparent peer-focus:top-0 peer-focus:text-[11px] peer-focus:bg-white peer-focus:text-[var(--color-plum)] peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:bg-white"
            )}
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
