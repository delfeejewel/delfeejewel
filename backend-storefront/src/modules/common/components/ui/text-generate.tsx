"use client"

import { useEffect, useState } from "react"
import { motion, stagger, useAnimate } from "framer-motion"
import { cn } from "@lib/utils/cn"

export function TextGenerateEffect({
  words,
  className,
  delay = 0,
}: {
  words: string
  className?: string
  delay?: number
}) {
  const [scope, animate] = useAnimate()
  const [mounted, setMounted] = useState(false)
  const wordsArray = words.split(" ")

  useEffect(() => {
    setMounted(true)
    const timer = setTimeout(() => {
      animate(
        "span",
        { opacity: 1, filter: "blur(0px)" },
        { duration: 0.4, delay: stagger(0.06) }
      )
    }, delay)
    return () => clearTimeout(timer)
  }, [animate, delay])

  // Server render: show text immediately (no animation)
  if (!mounted) {
    return (
      <p className={cn(className)} style={{ color: "var(--color-text-secondary)" }}>
        {words}
      </p>
    )
  }

  return (
    <motion.p ref={scope} className={cn(className)}>
      {wordsArray.map((word, idx) => (
        <motion.span
          key={word + idx}
          className="inline-block mr-[0.3em]"
          style={{ opacity: 0, filter: "blur(8px)" }}
        >
          {word}
        </motion.span>
      ))}
    </motion.p>
  )
}
