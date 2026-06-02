"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@lib/utils/cn"

export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "normal",
  className,
}: {
  items: { text: string; icon?: string }[]
  direction?: "left" | "right"
  speed?: "fast" | "normal" | "slow"
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  const duration =
    speed === "fast" ? "20s" : speed === "normal" ? "40s" : "60s"
  const animDirection = direction === "left" ? "forwards" : "reverse"

  useEffect(() => {
    setMounted(true)
  }, [])

  // Render items twice for seamless loop
  const allItems = [...items, ...items]

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-20 overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_10%,white_90%,transparent)]",
        className
      )}
      style={{
        ["--animation-duration" as string]: duration,
        ["--animation-direction" as string]: animDirection,
      }}
    >
      <ul
        className={cn(
          "flex shrink-0 gap-6 py-4 w-max flex-nowrap",
          mounted && "animate-scroll"
        )}
      >
        {allItems.map((item, idx) => (
          <li
            key={idx}
            className="flex items-center gap-3 px-6 py-3 rounded-full whitespace-nowrap"
            style={{
              background: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            {item.icon && <span className="text-base">{item.icon}</span>}
            <span
              className="text-sm font-medium tracking-wide"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
