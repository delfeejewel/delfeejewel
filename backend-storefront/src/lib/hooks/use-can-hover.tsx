"use client"

import { useEffect, useState } from "react"

/**
 * True only on devices with a real hovering pointer (mouse/trackpad).
 *
 * Touchscreens report a tap as a hover and keep that state until you tap
 * somewhere else, so hover-driven effects — image zoom, reveal-on-hover
 * overlays — fire on the way to opening a link. Anything driven by JS hover
 * state should be gated on this; CSS `hover:` utilities are already handled by
 * `hoverOnlyWhenSupported` in the Tailwind config.
 *
 * Starts false so the first client render matches the server's HTML; a
 * mouse-user gets the effects a tick later.
 */
export function useCanHover() {
  const [canHover, setCanHover] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)")
    const update = () => setCanHover(mq.matches)
    update()
    // A 2-in-1 can switch between touch and trackpad without a reload.
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  return canHover
}
