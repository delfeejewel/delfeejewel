import Image from "next/image"
import { Heart } from "lucide-react"
import { BRAND } from "@lib/constants.brand"

const FEED_IMAGES = [
  "/images/instagram-feed_1.png",
  "/images/instagram-feed_2.png",
  "/images/instagram-feed_3.png",
  "/images/instagram-feed_4.png",
  "/images/instagram-feed_5.png",
  "/images/instagram-feed_6.png",
]

export default function InstagramFeed() {
  return (
    <section className="py-16 small:py-20">
      <div className="max-w-[1400px] w-full mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col small:flex-row justify-between items-center mb-12 gap-4">
          <div className="text-center small:text-left">
            <h2 className="font-wittgenstein text-2xl small:text-3xl text-[var(--color-plum)]">
              As Seen On You
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Tag{" "}
              <span className="font-semibold">
                #{BRAND.name}Stories
              </span>{" "}
              for a chance to be featured.
            </p>
          </div>
          <a
            href={`https://instagram.com/${BRAND.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-semibold text-[var(--color-gold)] hover:text-[var(--color-plum)] transition-colors"
          >
            Follow us @{BRAND.name}
          </a>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 xsmall:grid-cols-3 small:grid-cols-6 gap-2">
          {FEED_IMAGES.map((src, i) => (
            <div
              key={i}
              className="aspect-square relative group overflow-hidden bg-[var(--color-bg-secondary)]"
            >
              <Image
                src={src}
                alt={`Instagram post ${i + 1}`}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-700 cursor-pointer"
                sizes="(max-width: 512px) 50vw, (max-width: 1024px) 33vw, 16vw"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <Heart className="w-6 h-6 text-white fill-white" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
