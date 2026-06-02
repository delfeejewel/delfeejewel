import { Metadata } from "next"

import Hero from "@modules/home/components/hero"
import CategoryGrid from "@modules/home/components/category-grid"
import BrandStory from "@modules/home/components/brand-story"
import ShopByOccasion from "@modules/home/components/shop-by-occasion"
import ProductCarousel from "@modules/home/components/product-carousel"
import Testimonials from "@modules/home/components/testimonials"
import PromoGrid from "@modules/home/components/promo-grid"
import InstagramFeed from "@modules/home/components/instagram-feed"
import TrustSignals from "@modules/home/components/trust-signals"
import MobileBottomNav from "@modules/home/components/mobile-bottom-nav"
import PromoBanners from "@modules/home/components/promo-banners"
import ShopByGender from "@modules/home/components/shop-by-gender"
import { listProducts } from "@lib/data/products"
import { listCategories } from "@lib/data/categories"
import { getRegion } from "@lib/data/regions"
import {
  getHeroSlides,
  getPromoBanners,
  getExperienceFeatures,
  getReviewSource,
  getReviews,
  getDynamicReviews,
} from "@lib/data/cms"
import { BRAND } from "@lib/constants.brand"

export const metadata: Metadata = {
  title: BRAND.meta.title,
  description: BRAND.description,
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params
  const { countryCode } = params

  const [
    region,
    categories,
    featuredProductsData,
    heroSlides,
    promoBanners,
    experienceFeatures,
    reviewSource,
  ] = await Promise.all([
    getRegion(countryCode),
    listCategories({ limit: 20 }),
    listProducts({ countryCode, queryParams: { limit: 12 } }),
    getHeroSlides(),
    getPromoBanners(),
    getExperienceFeatures(),
    getReviewSource(),
  ])

  const reviews =
    reviewSource === "dynamic" ? await getDynamicReviews() : await getReviews()

  const topLevelCategories =
    categories
      ?.filter((c) => !c.parent_category)
      ?.map((c) => ({
        name: c.name,
        handle: c.handle,
        cover_image: (c.metadata?.cover_image as string) || null,
      })) || []

  const featuredProducts = featuredProductsData?.response?.products || []

  if (!region) {
    return null
  }

  return (
    <div className="font-outfit bg-[var(--color-bg-primary)]">
      <Hero slides={heroSlides ?? undefined} />
      <CategoryGrid categories={topLevelCategories} />
      <PromoBanners banners={promoBanners} />
      <ProductCarousel products={featuredProducts} region={region} />
      <ShopByOccasion />
      <BrandStory />
      <Testimonials reviews={reviews} />
      <ShopByGender />
      <PromoGrid />
      <InstagramFeed />
      <TrustSignals features={experienceFeatures} />
      <MobileBottomNav />
    </div>
  )
}
