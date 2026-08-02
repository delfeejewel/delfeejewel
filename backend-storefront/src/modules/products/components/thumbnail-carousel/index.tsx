"use client"

import { clx } from "@medusajs/ui"
import Image from "next/image"
import React, { useRef, useState } from "react"

const FALLBACK_IMAGE = "/images/fallback-no-image.png"
const MAX_SLIDES = 5

const isVideo = (url: string) => /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(url)

type ThumbnailCarouselProps = {
  thumbnail?: string | null
  images?: any[] | null
  isFeatured?: boolean
  className?: string
  "data-testid"?: string
}

/**
 * The listing tile's image area: the same still thumbnail as before, plus
 * navigation dots when the product has more than one photo so a shopper can
 * flick through the gallery without leaving the grid.
 *
 * Lives inside a `<LocalizedClientLink>`, so every dot has to swallow the
 * click — otherwise picking an image navigates to the product page.
 */
const ThumbnailCarousel: React.FC<ThumbnailCarouselProps> = ({
  thumbnail,
  images,
  isFeatured,
  className,
  "data-testid": dataTestid,
}) => {
  // Photos only — a card must never render an mp4 — with the thumbnail first
  // and de-duplicated against the gallery so it isn't shown twice.
  const photos = (images ?? [])
    .map((i) => i?.url)
    .filter((url): url is string => Boolean(url) && !isVideo(url))

  const slides = [
    ...(thumbnail ? [thumbnail] : []),
    ...photos.filter((url) => url !== thumbnail),
  ].slice(0, MAX_SLIDES)

  if (slides.length === 0) {
    slides.push(FALLBACK_IMAGE)
  }

  const [active, setActive] = useState(0)

  const goTo = (index: number) => (e: React.MouseEvent) => {
    // Inside a link: don't navigate, just swap the image.
    e.preventDefault()
    e.stopPropagation()
    setActive(index)
  }

  // Horizontal drag steps through the photos on touch; vertical is left to the
  // page so scrolling still works. The click a swipe ends in is swallowed so
  // flicking through photos doesn't open the product page.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const SWIPE_MIN_PX = 40

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
    swiped.current = false
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || slides.length < 2) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return
    swiped.current = true
    setActive((i) =>
      dx < 0 ? Math.min(i + 1, slides.length - 1) : Math.max(i - 1, 0)
    )
  }

  const suppressClickAfterSwipe = (e: React.MouseEvent) => {
    if (!swiped.current) return
    swiped.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      className={clx(
        "relative w-full overflow-hidden group",
        isFeatured ? "aspect-[11/14]" : "aspect-square",
        className
      )}
      style={{ background: "var(--color-bg-secondary)", touchAction: "pan-y" }}
      data-testid={dataTestid}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClickCapture={suppressClickAfterSwipe}
    >
      {slides.map((url, i) => (
        <Image
          key={`${url}-${i}`}
          src={url}
          alt="Thumbnail"
          className={clx(
            "absolute inset-0 object-cover object-center transition-opacity duration-500 ease-out",
            i === active ? "opacity-100" : "opacity-0"
          )}
          draggable={false}
          quality={50}
          priority={false}
          loading={i === 0 ? undefined : "lazy"}
          sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
          fill
        />
      ))}

      {slides.length > 1 && (
        <div
          className="absolute inset-x-0 bottom-2 z-10 flex items-center justify-center"
          data-testid="thumbnail-dots"
        >
          {/* A pill behind the dots: product photography runs from white
              packshots to near-black model shots, and no single dot colour
              stays legible across both. */}
          <span
            className="flex items-center rounded-full px-1"
            style={{
              background: "rgba(255,255,255,0.62)",
              backdropFilter: "blur(6px)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            }}
          >
          {slides.map((_, i) => (
            // Padding, not size: the dot stays small while the tap target
            // clears the ~44px minimum on touch.
            <button
              key={i}
              type="button"
              onClick={goTo(i)}
              aria-label={`Show image ${i + 1} of ${slides.length}`}
              aria-current={i === active}
              className="flex items-center justify-center px-1.5 py-2"
            >
              <span
                className={clx(
                  "block h-1.5 rounded-full transition-all duration-300 ease-out",
                  i === active ? "w-4" : "w-1.5"
                )}
                style={{
                  background:
                    i === active ? "var(--color-accent)" : "rgba(0, 0, 0, 0.28)",
                }}
              />
            </button>
          ))}
          </span>
        </div>
      )}
    </div>
  )
}

export default ThumbnailCarousel
