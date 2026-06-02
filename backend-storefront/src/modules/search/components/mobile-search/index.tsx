"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Search } from "lucide-react"

import SearchAutocomplete from "../search-autocomplete"

export default function MobileSearch() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="small:hidden w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors duration-200"
        title="Search"
        aria-label="Open search"
        data-testid="mobile-search-trigger"
      >
        <Search
          size={20}
          strokeWidth={1.5}
          className="text-[var(--color-text-secondary)]"
        />
      </button>

      {/*
       * Rendered through a portal to <body>: the nav <header> has
       * backdrop-filter, which would otherwise trap this fixed overlay
       * inside the header's containing block instead of the viewport.
       */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[200] bg-white p-4 small:hidden">
            <SearchAutocomplete
              variant="mobile"
              autoFocus
              onClose={() => setOpen(false)}
            />
          </div>,
          document.body
        )}
    </>
  )
}
