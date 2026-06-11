"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { ZoomIn, X, ChevronLeft, ChevronRight, Play } from "lucide-react"

type MediaItem = { id: string; url: string; type: "image" | "video" }

type GalleryProps = {
  media: MediaItem[]
  title: string
}

const FALLBACK = "/images/fallback-no-image.png"

export default function ProductGallery({ media, title }: GalleryProps) {
  const allMedia: MediaItem[] = media.length
    ? media
    : [{ id: "fb", url: FALLBACK, type: "image" }]

  // Open on the first image (not a video) when possible
  const firstImageIndex = Math.max(
    0,
    allMedia.findIndex((m) => m.type === "image")
  )
  const posterUrl =
    allMedia.find((m) => m.type === "image")?.url || FALLBACK

  const [selected, setSelected] = useState(firstImageIndex)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })
  const [mounted, setMounted] = useState(false)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => setMounted(true), [])

  const current = allMedia[selected] ?? allMedia[0]
  const isVideo = current.type === "video"

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  const prev = () => setSelected((s) => (s - 1 + allMedia.length) % allMedia.length)
  const next = () => setSelected((s) => (s + 1) % allMedia.length)

  return (
    <>
      <motion.div
        ref={ref}
        className="flex flex-col-reverse gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        {/* Vertical thumbnails */}
        {allMedia.length > 1 && (
          <div className="flex gap-3 overflow-x-auto no-scrollbar shrink-0 p-1">
            {allMedia.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setSelected(i)}
                className={`relative w-16 h-16 medium:w-20 medium:h-20 rounded-lg overflow-hidden shrink-0 transition-all duration-300 ${
                  selected === i
                    ? "border-2 border-[var(--color-gold)] shadow-[0_0_0_2px_var(--color-bg-primary),0_0_0_4px_var(--color-gold)] opacity-100"
                    : "opacity-50 hover:opacity-80 border border-[var(--color-lavender)]"
                }`}
              >
                {m.type === "video" ? (
                  <>
                    <video
                      src={m.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover bg-black"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <Play size={16} className="text-white fill-white" />
                    </span>
                  </>
                ) : (
                  <Image src={m.url} alt={`${title} ${i + 1}`} fill className="object-cover" sizes="80px" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Main media */}
        <div className="relative flex-1 group">
          {/* Luxury gradient glow behind image */}
          <div
            className="absolute inset-0 rounded-2xl -z-10 blur-2xl opacity-40"
            style={{
              background: "radial-gradient(ellipse at 30% 50%, var(--color-lavender) 0%, transparent 60%)",
              transform: "scale(1.05)",
            }}
          />

          <div
            className="relative aspect-square rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(93,46,70,0.08)]"
            onMouseEnter={() => !isVideo && setZoomed(true)}
            onMouseLeave={() => setZoomed(false)}
            onMouseMove={isVideo ? undefined : handleMouseMove}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white w-full h-full"
              >
                {isVideo ? (
                  <video
                    src={current.url}
                    controls
                    playsInline
                    preload="metadata"
                    poster={posterUrl}
                    className="w-full h-full object-cover bg-black"
                  />
                ) : (
                  <Image
                    src={current.url}
                    alt={title}
                    width={800}
                    height={800}
                    className="w-full h-full object-cover transition-transform duration-300 ease-out cursor-zoom-in"
                    style={{
                      transform: zoomed ? "scale(2)" : "scale(1)",
                      transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
                    }}
                    priority
                    sizes="(max-width: 768px) 100vw, 58vw"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Expand button — opens lightbox (hidden for videos, which have their own controls) */}
            {!isVideo && (
              <button
                onClick={() => setLightboxOpen(true)}
                className="absolute bottom-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-white hover:shadow-md z-10"
              >
                <ZoomIn size={13} /> Expand
              </button>
            )}

            {/* Nav arrows */}
            {allMedia.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prev() }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:scale-110 z-10"
                >
                  <ChevronLeft size={18} className="text-[var(--color-text-primary)]" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); next() }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:scale-110 z-10"
                >
                  <ChevronRight size={18} className="text-[var(--color-text-primary)]" />
                </button>
              </>
            )}

            {/* Media counter */}
            {allMedia.length > 1 && (
              <div className="absolute bottom-5 left-5 px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm text-[11px] font-medium text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity">
                {selected + 1} / {allMedia.length}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Lightbox — portalled to body, card-style popup (images only) */}
      {mounted && lightboxOpen && createPortal(
        <motion.div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 99999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setLightboxOpen(false)}
        >
          <motion.div
            className="relative w-[92vw] max-w-[800px] rounded-2xl overflow-hidden bg-white shadow-2xl"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top bar */}
            <div className="h-1 bg-gradient-to-r from-[var(--color-plum)] to-[var(--color-gold)]" />

            {/* Close button */}
            <button
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center hover:bg-[var(--color-lavender)] transition-colors"
              style={{ zIndex: 10 }}
              onClick={() => setLightboxOpen(false)}
            >
              <X size={18} className="text-[var(--color-text-secondary)]" />
            </button>

            {/* Media area */}
            <div className="relative aspect-square max-h-[75vh] bg-[var(--color-bg-primary)]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {current.type === "video" ? (
                    <video
                      src={current.url}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : (
                    <Image
                      src={current.url}
                      alt={title}
                      fill
                      className="object-contain p-6"
                      sizes="800px"
                      priority
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Prev / Next */}
              {allMedia.length > 1 && (
                <>
                  <button
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 shadow-sm flex items-center justify-center hover:bg-white hover:shadow-md transition-all z-10"
                    onClick={prev}
                  >
                    <ChevronLeft size={20} className="text-[var(--color-text-primary)]" />
                  </button>
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 shadow-sm flex items-center justify-center hover:bg-white hover:shadow-md transition-all z-10"
                    onClick={next}
                  >
                    <ChevronRight size={20} className="text-[var(--color-text-primary)]" />
                  </button>
                </>
              )}
            </div>

            {/* Bottom bar — thumbnails + counter */}
            {allMedia.length > 1 && (
              <div className="flex items-center justify-center gap-3 py-4 px-6 border-t border-[var(--color-lavender)]">
                {allMedia.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => setSelected(i)}
                    className={`relative w-14 h-14 rounded-lg overflow-hidden shrink-0 transition-all duration-200 ${
                      selected === i
                        ? "ring-2 ring-[var(--color-gold)] ring-offset-1"
                        : "opacity-40 hover:opacity-70 border border-[var(--color-lavender)]"
                    }`}
                  >
                    {m.type === "video" ? (
                      <>
                        <video src={m.url} muted playsInline preload="metadata" className="w-full h-full object-cover bg-black" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <Play size={12} className="text-white fill-white" />
                        </span>
                      </>
                    ) : (
                      <Image src={m.url} alt="" fill className="object-cover" sizes="56px" />
                    )}
                  </button>
                ))}
                <span className="ml-3 text-[12px] font-medium text-[var(--color-text-muted)] tabular-nums">
                  {selected + 1} / {allMedia.length}
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>,
        document.body
      )}
    </>
  )
}
