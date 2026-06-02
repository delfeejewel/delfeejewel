import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (!BACKEND_URL) {
    throw new Error(
      "Middleware.ts: Error fetching regions. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable? Note that the variable is no longer named NEXT_PUBLIC_MEDUSA_BACKEND_URL."
    )
  }

  if (
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - 3600 * 1000
  ) {
    // Fetch regions from Medusa. We can't use the JS client here because middleware is running on Edge and the client needs a Node environment.
    const { regions } = await fetch(`${BACKEND_URL}/store/regions`, {
      headers: {
        "x-publishable-api-key": PUBLISHABLE_API_KEY!,
      },
      next: {
        revalidate: 3600,
        tags: [`regions-${cacheId}`],
      },
      cache: "force-cache",
    }).then(async (response) => {
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.message)
      }

      return json
    })

    if (!regions?.length) {
      throw new Error(
        "No regions found. Please set up regions in your Medusa Admin."
      )
    }

    // Create a map of country codes to regions.
    regions.forEach((region: HttpTypes.StoreRegion) => {
      region.countries?.forEach((c) => {
        regionMapCache.regionMap.set(c.iso_2 ?? "", region)
      })
    })

    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */
async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
) {
  try {
    let countryCode

    const vercelCountryCode = request.headers
      .get("x-vercel-ip-country")
      ?.toLowerCase()

    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else if (regionMap.keys().next().value) {
      countryCode = regionMap.keys().next().value
    }

    return countryCode
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Middleware.ts: Error getting the country code. Did you set up regions in your Medusa Admin and define a MEDUSA_BACKEND_URL environment variable? Note that the variable is no longer named NEXT_PUBLIC_MEDUSA_BACKEND_URL."
      )
    }
  }
}

/**
 * COMING_SOON_MODE kill-switch
 *
 * When the env var COMING_SOON_MODE=true, every public request is redirected
 * to /coming-soon. Carve-outs:
 *   - /coming-soon (the page itself + its assets)
 *   - /api/notify-launch (email capture endpoint)
 *   - /admin/* (Medusa admin still reachable)
 *   - /_next/* + static files
 *
 * QA bypass: visit any path with ?qa=<COMING_SOON_QA_TOKEN> to set a
 * `qa_bypass=1` cookie that exempts the browser from the redirect. Useful
 * for internal demos while the rest of the world sees the coming-soon page.
 *
 * To go live: unset COMING_SOON_MODE (or set it to anything other than
 * "true"), redeploy.
 */
const COMING_SOON_BYPASS_PATHS = [
  "/coming-soon",
  "/api/notify-launch",
  "/admin",
  "/_next",
  "/favicon",
  "/images",
  "/robots",
  "/sitemap",
]

function isComingSoonAllowed(pathname: string): boolean {
  if (pathname.includes(".")) return true // static assets
  return COMING_SOON_BYPASS_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`)
  )
}

/**
 * Middleware to handle region selection and onboarding status.
 */
export async function middleware(request: NextRequest) {
  // The coming-soon page is self-contained (no region/cart deps). Don't run
  // the region-map fetch for it — that way the page still serves even if the
  // backend is offline.
  if (
    request.nextUrl.pathname === "/coming-soon" ||
    request.nextUrl.pathname.startsWith("/api/notify-launch") ||
    request.nextUrl.pathname.startsWith("/api/qa-access")
  ) {
    return NextResponse.next()
  }

  // ─── Coming-soon kill-switch ───────────────────────────────
  if (process.env.COMING_SOON_MODE === "true") {
    const qaToken = process.env.COMING_SOON_QA_TOKEN
    const url = request.nextUrl

    // QA bypass via ?qa=<token>
    const qaParam = url.searchParams.get("qa")
    if (qaToken && qaParam && qaParam === qaToken) {
      const stripped = new URL(url.href)
      stripped.searchParams.delete("qa")
      const res = NextResponse.redirect(stripped, 307)
      res.cookies.set("qa_bypass", "1", {
        maxAge: 60 * 60 * 24 * 30,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      })
      return res
    }

    const hasBypassCookie = request.cookies.get("qa_bypass")?.value === "1"
    if (!hasBypassCookie && !isComingSoonAllowed(url.pathname)) {
      return NextResponse.redirect(new URL("/coming-soon", url), 307)
    }
    // Fall through to normal middleware if allowed/bypassed
  }

  // Static assets should never hit the region-map fetch
  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  let redirectUrl = request.nextUrl.href

  let response = NextResponse.redirect(redirectUrl, 307)

  let cacheIdCookie = request.cookies.get("_medusa_cache_id")

  let cacheId = cacheIdCookie?.value || crypto.randomUUID()

  const regionMap = await getRegionMap(cacheId)

  const countryCode = regionMap && (await getCountryCode(request, regionMap))

  const urlHasCountryCode =
    countryCode && request.nextUrl.pathname.split("/")[1].includes(countryCode)

  // Cart recovery deep link from the abandoned-cart email:
  //   /{country}/cart/recover/{cartId}
  // Set the cart cookie here in middleware so the page can render UI without
  // mutating cookies (page.tsx server components can't set cookies in Next.js 15).
  // The page still validates the cart exists; if it doesn't, it redirects home.
  const recoverMatch = request.nextUrl.pathname.match(
    /^\/[^/]+\/cart\/recover\/([^/?#]+)/
  )
  if (recoverMatch && urlHasCountryCode) {
    const recoveredCartId = recoverMatch[1]
    const passThrough = NextResponse.next()
    passThrough.cookies.set("_medusa_cart_id", recoveredCartId, {
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    })
    if (!cacheIdCookie) {
      passThrough.cookies.set("_medusa_cache_id", cacheId, {
        maxAge: 60 * 60 * 24,
      })
    }
    return passThrough
  }

  // if one of the country codes is in the url and the cache id is set, return next
  if (urlHasCountryCode && cacheIdCookie) {
    return NextResponse.next()
  }

  // if one of the country codes is in the url and the cache id is not set, set the cache id and redirect
  if (urlHasCountryCode && !cacheIdCookie) {
    response.cookies.set("_medusa_cache_id", cacheId, {
      maxAge: 60 * 60 * 24,
    })

    return response
  }

  const redirectPath =
    request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname

  const queryString = request.nextUrl.search ? request.nextUrl.search : ""

  // If no country code is set, we redirect to the relevant region.
  if (!urlHasCountryCode && countryCode) {
    redirectUrl = `${request.nextUrl.origin}/${countryCode}${redirectPath}${queryString}`
    response = NextResponse.redirect(`${redirectUrl}`, 307)
  } else if (!urlHasCountryCode && !countryCode) {
    // Handle case where no valid country code exists (empty regions)
    return new NextResponse(
      "No valid regions configured. Please set up regions with countries in your Medusa Admin.",
      { status: 500 }
    )
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
