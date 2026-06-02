import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPage } from "@lib/data/cms"
import { BRAND } from "@lib/constants.brand"
import DOMPurify from "isomorphic-dompurify"

type Props = {
  params: Promise<{ slug: string; countryCode: string }>
}

// Reserved slugs that should NOT be handled by this dynamic route
const RESERVED_SLUGS = [
  "store",
  "cart",
  "account",
  "checkout",
  "categories",
  "collections",
  "products",
  "order",
  "wishlist",
]

// Skip file-like slugs (e.g. image paths that 404)
const isFilePath = (slug: string) => /\.\w{2,5}$/.test(slug)

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params

  if (RESERVED_SLUGS.includes(slug) || isFilePath(slug)) {
    return {}
  }

  const page = await getPage(slug)

  if (!page) {
    return { title: `Page Not Found | ${BRAND.meta.productSuffix}` }
  }

  return {
    title: page.meta_title || `${page.title} | ${BRAND.meta.productSuffix}`,
    description: page.meta_description || page.title,
  }
}

export default async function DynamicPage(props: Props) {
  const { slug } = await props.params

  if (RESERVED_SLUGS.includes(slug) || isFilePath(slug)) {
    notFound()
  }

  const page = await getPage(slug)

  if (!page) {
    notFound()
  }

  return (
    <div className="content-container py-12 small:py-20">
      <div className="max-w-3xl mx-auto">
        <h1
          className="font-wittgenstein text-3xl small:text-[42px] leading-tight tracking-tight mb-6"
          style={{ color: "var(--color-text-primary)" }}
        >
          {page.title}
        </h1>

        {page.content && (
          <div
            className="prose prose-base max-w-none"
            style={{ color: "var(--color-text-secondary)" }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content) }}
          />
        )}
      </div>
    </div>
  )
}
