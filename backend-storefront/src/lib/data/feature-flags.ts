import "server-only"

import { sdk } from "@lib/config"

export type StoreFeatureFlags = {
  returns_enabled: boolean
}

const DEFAULTS: StoreFeatureFlags = {
  returns_enabled: true,
}

/**
 * Storefront feature toggles (managed by developers in the admin).
 * Short revalidation so a flipped toggle reaches the storefront within a
 * minute without a redeploy. Fails open to defaults so a backend hiccup
 * never blanks out working features.
 */
export async function getFeatureFlags(): Promise<StoreFeatureFlags> {
  try {
    const { flags } = await sdk.client.fetch<{ flags: StoreFeatureFlags }>(
      "/store/feature-flags",
      {
        method: "GET",
        next: { revalidate: 60 },
        cache: "force-cache",
      }
    )
    return { ...DEFAULTS, ...flags }
  } catch {
    return { ...DEFAULTS }
  }
}
