"use server"

import { supabase } from "@lib/supabase"
import type { Review } from "@modules/home/components/testimonials"

export type SectionHeader = {
  subtitle?: string
  title?: string
  description?: string
  image_url?: string
}

export async function getSectionHeaders(): Promise<Record<string, SectionHeader>> {
  const { data, error } = await supabase
    .from("cms_section_headers")
    .select("section_key, subtitle, title, description, image_url")

  if (error || !data?.length) return {}

  return data.reduce((acc: Record<string, SectionHeader>, row) => {
    acc[row.section_key] = {
      subtitle: row.subtitle || undefined,
      title: row.title || undefined,
      description: row.description || undefined,
      image_url: row.image_url || undefined,
    }
    return acc
  }, {})
}

export async function getReviewSource(): Promise<"static" | "dynamic"> {
  const { data } = await supabase
    .from("cms_homepage_settings")
    .select("config")
    .eq("section_key", "reviews")
    .single()

  return data?.config?.review_source || "static"
}

export async function getDynamicReviews(): Promise<Review[] | null> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select("*")
    .eq("status", "approved")
    .gte("rating", 4)
    .order("created_at", { ascending: false })
    .limit(7)

  if (error || !data?.length) return null

  return data.map((r) => ({
    name: r.customer_name,
    rating: Number(r.rating),
    ratingCount: null,
    text: r.text,
    product: r.product_name,
    productImage: r.product_image || "/images/fallback-no-image.png",
    location: "",
    date: timeAgo(r.created_at),
  }))
}

export async function getHeroSlides() {
  const { data, error } = await supabase
    .from("cms_hero_slides")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error || !data?.length) return null
  return data
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks > 1 ? "s" : ""} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months > 1 ? "s" : ""} ago`
}

export async function getReviews(): Promise<Review[] | null> {
  const { data, error } = await supabase
    .from("cms_reviews")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error || !data?.length) return null

  return data.map((r) => ({
    name: r.name,
    rating: r.rating,
    ratingCount: r.rating_count || null,
    text: r.text,
    product: r.product_name,
    productImage: r.product_image || "/images/fallback-no-image.png",
    location: r.location || "",
    date: r.date_label || timeAgo(r.created_at),
  }))
}

export async function getPromoBanners() {
  const { data, error } = await supabase
    .from("cms_promo_banners")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error || !data?.length) return null
  return data
}


export async function getFindStoreConfig() {
  const { data } = await supabase
    .from("cms_homepage_settings")
    .select("config")
    .eq("section_key", "find_store")
    .single()

  return data?.config || null
}

export async function getStoreInfo() {
  const { data, error } = await supabase
    .from("cms_store_info")
    .select("*")
    .limit(1)
    .single()

  if (error || !data) return null
  return data
}

export type SectionVisibility = Record<string, boolean>

export async function getHomepageSections(): Promise<SectionVisibility> {
  const { data, error } = await supabase
    .from("cms_homepage_settings")
    .select("section_key, is_visible")

  if (error || !data?.length) {
    // Default: all visible
    return {}
  }

  return data.reduce((acc: SectionVisibility, row) => {
    acc[row.section_key] = row.is_visible
    return acc
  }, {})
}

export async function getExperienceFeatures() {
  const { data, error } = await supabase
    .from("cms_experience_features")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error || !data?.length) return null
  return data
}

export async function getCustomSections(pageSlug: string = "homepage") {
  const { data, error } = await supabase
    .from("cms_custom_sections")
    .select("*")
    .eq("page_slug", pageSlug)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error || !data?.length) return null
  return data
}

export async function getHomepageCategories() {
  const { data, error } = await supabase
    .from("cms_homepage_categories")
    .select("category_id, category_name, category_handle, cover_image")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error || !data?.length) return null

  return data.map((c) => ({
    id: c.category_id,
    name: c.category_name,
    handle: c.category_handle,
    cover_image: c.cover_image || null,
  }))
}

export async function getPage(slug: string) {
  const { data, error } = await supabase
    .from("cms_pages")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single()

  if (error || !data) return null
  return data
}

export async function getHeaderSettings() {
  const { data, error } = await supabase
    .from("cms_header_settings")
    .select("*")
    .limit(1)
    .single()

  if (error || !data) return null
  return data
}

export async function getFooterSettings() {
  const { data, error } = await supabase
    .from("cms_footer_settings")
    .select("*")
    .limit(1)
    .single()

  if (error || !data) return null
  return data
}

export type MenuItem = { label: string; href: string }
export type Menu = { name: string; items: MenuItem[] }

// Fetch active menus for the given locations (+ their items) in two queries.
// Returns a map keyed by location. If two menus share a location, the one with
// the higher sort_order wins.
export async function getMenus(
  locations: string[]
): Promise<Record<string, Menu>> {
  const { data: menus, error } = await supabase
    .from("cms_menus")
    .select("id, name, location")
    .in("location", locations)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error || !menus?.length) return {}

  const ids = menus.map((m) => m.id)
  const { data: items } = await supabase
    .from("cms_menu_items")
    .select("menu_id, label, href, sort_order, is_active")
    .in("menu_id", ids)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  const itemsByMenu = (items || []).reduce(
    (acc: Record<string, MenuItem[]>, row) => {
      ;(acc[row.menu_id] ||= []).push({ label: row.label, href: row.href })
      return acc
    },
    {}
  )

  return menus.reduce((acc: Record<string, Menu>, m) => {
    acc[m.location] = { name: m.name, items: itemsByMenu[m.id] || [] }
    return acc
  }, {})
}

export async function getMenu(location: string): Promise<Menu | null> {
  const map = await getMenus([location])
  return map[location] || null
}
