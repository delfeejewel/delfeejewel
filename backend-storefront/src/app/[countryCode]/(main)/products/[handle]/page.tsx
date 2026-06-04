import { Metadata } from "next"
import { notFound } from "next/navigation"
import { listProducts } from "@lib/data/products"
import { getRegion, listRegions } from "@lib/data/regions"
import { retrieveCustomer } from "@lib/data/customer"
import { getWishlistProductIds } from "@lib/data/wishlist"
import { BRAND } from "@lib/constants.brand"
import ProductTemplate from "@modules/products/templates"
import GiftCardTemplate from "@modules/gift-card/templates"
import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "@lib/util/get-product-price"
import { getBaseURL } from "@lib/util/env"

// Read per-user cookies (customer/wishlist/cart) -> must render at request time.
// generateStaticParams returns [] when the backend is unreachable at build
// (Docker image build); without this, Next throws DYNAMIC_SERVER_USAGE.
export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<{ v_id?: string }>
}

export async function generateStaticParams() {
  try {
    const countryCodes = await listRegions().then((regions) =>
      regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
    )

    if (!countryCodes) return []

    const promises = countryCodes.map(async (country) => {
      const { response } = await listProducts({
        countryCode: country,
        queryParams: { limit: 100, fields: "handle" },
      })
      return { country, products: response.products }
    })

    const countryProducts = await Promise.all(promises)

    return countryProducts
      .flatMap((d) => d.products.map((p) => ({ countryCode: d.country, handle: p.handle })))
      .filter((p) => p.handle)
  } catch {
    return []
  }
}

function getImagesForVariant(
  product: HttpTypes.StoreProduct,
  selectedVariantId?: string
) {
  if (!selectedVariantId || !product.variants) return product.images || []
  const variant = product.variants.find((v) => v.id === selectedVariantId)
  if (!variant || !variant.images?.length) return product.images || []
  const imageIdsMap = new Map(variant.images.map((i) => [i.id, true]))
  return (product.images || []).filter((i) => imageIdsMap.has(i.id))
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const baseUrl = getBaseURL()

  const product = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle: params.handle },
  }).then(({ response }) => response.products[0])

  if (!product) {
    return { title: `Product Not Found | ${BRAND.meta.productSuffix}` }
  }

  const { cheapestPrice } = getProductPrice({ product })
  const meta = (product.metadata || {}) as Record<string, any>
  const category = (product as any).categories?.[0]
  const url = `${baseUrl}/${params.countryCode}/products/${params.handle}`
  const images = product.images?.map((img) => img.url) || (product.thumbnail ? [product.thumbnail] : [])

  // Build SEO-rich title: "Product Title — Material | Brand"
  const capitalize = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())
  const title = capitalize(product.title || "")
  const material = capitalize(product.material || meta.metal || "")
  const seoTitle = material
    ? `${title} — ${material} | ${BRAND.meta.productSuffix}`
    : `${title} | ${BRAND.meta.productSuffix}`

  // Build SEO description
  const seoDescription = product.description
    ? product.description.slice(0, 160)
    : `Shop ${title} from ${BRAND.name}. ${BRAND.tagline}. Free shipping on orders above ₹999.`

  return {
    title: seoTitle,
    description: seoDescription,
    keywords: [
      product.title,
      material,
      category?.name,
      "silver jewellery",
      "925 sterling silver",
      "handcrafted jewellery",
      BRAND.name,
      "buy online",
      "India",
    ].filter(Boolean).join(", "),

    alternates: {
      canonical: url,
    },

    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },

    openGraph: {
      type: "website",
      title: seoTitle,
      description: seoDescription,
      url,
      siteName: BRAND.name,
      locale: "en_IN",
      images: images.map((img) => ({
        url: img,
        width: 800,
        height: 800,
        alt: title || "Product",
      })),
    },

    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description: seoDescription,
      images: images.slice(0, 1),
    },
  }
}

// ─── JSON-LD Structured Data ─────────────────────────
function ProductJsonLd({ product, countryCode }: { product: HttpTypes.StoreProduct; countryCode: string }) {
  const { cheapestPrice } = getProductPrice({ product })
  const capitalize = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())
  const meta = (product.metadata || {}) as Record<string, any>
  const category = (product as any).categories?.[0]
  const baseUrl = getBaseURL()
  const url = `${baseUrl}/${countryCode}/products/${product.handle}`
  const productTitle = capitalize(product.title || "")

  const inStock = product.variants?.some((v: any) =>
    !v.manage_inventory || v.allow_backorder || (v.inventory_quantity || 0) > 0
  )

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productTitle,
    description: product.description || `${productTitle} from ${BRAND.name}`,
    url,
    image: product.images?.map((img) => img.url) || [],
    sku: product.variants?.[0]?.sku || product.id,
    brand: {
      "@type": "Brand",
      name: BRAND.name,
    },
    ...(category && {
      category: category.name,
    }),
    ...(product.material && {
      material: product.material,
    }),
    ...(meta.weight && {
      weight: {
        "@type": "QuantitativeValue",
        value: meta.weight,
        unitCode: "GRM",
      },
    }),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: cheapestPrice?.currency_code?.toUpperCase() || "INR",
      price: cheapestPrice?.calculated_price_number
        ? (cheapestPrice.calculated_price_number / 100).toFixed(2)
        : undefined,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: BRAND.name,
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "0",
          currency: "INR",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: 2,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 3,
            maxValue: 5,
            unitCode: "DAY",
          },
        },
      },
    },
    // Static review aggregate — replace with real data later
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "128",
      bestRating: "5",
      worstRating: "1",
    },
  }

  // BreadcrumbList schema
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      ...(category
        ? [{ "@type": "ListItem", position: 2, name: category.name, item: `${baseUrl}/${countryCode}/categories/${category.handle}` }]
        : product.collection
        ? [{ "@type": "ListItem", position: 2, name: product.collection.title, item: `${baseUrl}/${countryCode}/collections/${product.collection.handle}` }]
        : [{ "@type": "ListItem", position: 2, name: "Products", item: `${baseUrl}/${countryCode}/store` }]
      ),
      { "@type": "ListItem", position: 3, name: productTitle },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </>
  )
}

export default async function ProductPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])

  const region = await getRegion(params.countryCode)
  if (!region) notFound()

  const [pricedProduct, customer, wishlistIds] = await Promise.all([
    listProducts({
      countryCode: params.countryCode,
      queryParams: { handle: params.handle },
    }).then(({ response }) => response.products[0]),
    retrieveCustomer().catch(() => null),
    getWishlistProductIds(),
  ])

  if (!pricedProduct) notFound()

  // Gift cards get a custom PDP (recipient form + denomination chips).
  if ((pricedProduct.metadata as any)?.is_gift_card === true) {
    const customerName =
      customer
        ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
          null
        : null
    return (
      <GiftCardTemplate
        product={pricedProduct}
        customerEmail={customer?.email}
        customerName={customerName}
      />
    )
  }

  const images = getImagesForVariant(pricedProduct, searchParams.v_id)

  return (
    <>
      <ProductJsonLd product={pricedProduct} countryCode={params.countryCode} />
      <ProductTemplate
        product={pricedProduct}
        region={region}
        countryCode={params.countryCode}
        images={images}
        isLoggedIn={!!customer}
        initialWishlisted={wishlistIds.includes(pricedProduct.id)}
      />
    </>
  )
}
