import { Container, clx } from "@medusajs/ui"
import Image from "next/image"
import React from "react"

const FALLBACK_IMAGE = "/images/fallback-no-image.png"

type ThumbnailProps = {
  thumbnail?: string | null
  // TODO: Fix image typings
  images?: any[] | null
  size?: "small" | "medium" | "large" | "full" | "square"
  isFeatured?: boolean
  className?: string
  "data-testid"?: string
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  size = "small",
  isFeatured,
  className,
  "data-testid": dataTestid,
}) => {
  const initialImage = thumbnail || images?.[0]?.url || FALLBACK_IMAGE

  return (
    <div
      className={clx(
        "relative w-full overflow-hidden group",
        className,
        {
          "aspect-[11/14]": isFeatured,
          "aspect-square": !isFeatured,
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full" || size === "square",
        }
      )}
      style={{ background: "var(--color-bg-secondary)" }}
      data-testid={dataTestid}
    >
      <Image
        src={initialImage}
        alt="Thumbnail"
        className="absolute inset-0 object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
        draggable={false}
        quality={50}
        sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
        fill
      />
    </div>
  )
}

export default Thumbnail
