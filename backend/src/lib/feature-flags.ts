import { Modules } from "@medusajs/framework/utils"

/**
 * Storefront feature toggles, persisted on the core Store record's metadata
 * (store.metadata.feature_flags) — no extra table/migration needed, and the
 * value survives deploys. Managed from the admin by DEVELOPER-role users only
 * (see /admin/feature-flags); read publicly by the storefront.
 *
 * `returns_enabled` — customer-facing returns & exchanges. When OFF, the
 * storefront hides all returns entry points and the backend rejects new
 * return-request creation. Admin-side processing of existing requests keeps
 * working either way, so the full flow stays testable internally.
 */

export type FeatureFlags = {
  returns_enabled: boolean
}

export const FLAG_DEFAULTS: FeatureFlags = {
  returns_enabled: true,
}

const FLAG_KEYS = Object.keys(FLAG_DEFAULTS) as (keyof FeatureFlags)[]

async function getStore(scope: any) {
  const storeModule = scope.resolve(Modules.STORE)
  const [store] = await storeModule.listStores({}, { take: 1 })
  return { storeModule, store }
}

export async function getFeatureFlags(scope: any): Promise<FeatureFlags> {
  try {
    const { store } = await getStore(scope)
    const saved = (store?.metadata as any)?.feature_flags || {}
    const flags = { ...FLAG_DEFAULTS }
    for (const key of FLAG_KEYS) {
      if (typeof saved[key] === "boolean") flags[key] = saved[key]
    }
    return flags
  } catch {
    return { ...FLAG_DEFAULTS }
  }
}

export async function setFeatureFlags(
  scope: any,
  updates: Partial<FeatureFlags>
): Promise<FeatureFlags> {
  const { storeModule, store } = await getStore(scope)
  if (!store) throw new Error("Store record not found")

  const current = await getFeatureFlags(scope)
  const next = { ...current }
  for (const key of FLAG_KEYS) {
    if (typeof updates[key] === "boolean") next[key] = updates[key]!
  }

  await storeModule.updateStores(store.id, {
    metadata: { ...(store.metadata || {}), feature_flags: next },
  })
  return next
}
