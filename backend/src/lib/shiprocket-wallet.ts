import { Modules } from "@medusajs/framework/utils"

/**
 * Shiprocket wallet gate, with hysteresis.
 *
 * Assigning an AWB is paid from the wallet, and an attempt can be charged even
 * when it fails — so a packer clicking "Assign courier" against a low wallet
 * burns money and gets no courier. This decides when that button is disabled.
 *
 * TWO thresholds, not one, deliberately:
 *   - below DISABLE_BELOW (₹150) → block
 *   - blocked until the balance recovers past REENABLE_ABOVE (₹500)
 *
 * A single threshold flaps: at ₹149 you block, one ₹5 top-up unblocks, the next
 * label re-blocks. The gap means once the wallet has run low it must be
 * genuinely refilled — not nudged over the line — before dispatch resumes.
 *
 * The blocked state is LATCHED in store metadata rather than recomputed from
 * the balance each time, because that is what makes the band meaningful: a
 * balance of ₹300 means "still blocked" if we fell below ₹150, and "fine" if we
 * never did.
 */

export const DISABLE_BELOW = Number(process.env.SHIPROCKET_WALLET_DISABLE_BELOW ?? 150)
export const REENABLE_ABOVE = Number(process.env.SHIPROCKET_WALLET_REENABLE_ABOVE ?? 500)

const BLOCK_KEY = "shiprocket_wallet_block"
const OVERRIDE_KEY = "shiprocket_wallet_override"

export type WalletBlock = {
  blocked: boolean
  since?: string | null
  last_balance?: number | null
}

export type WalletOverride = {
  active: boolean
  at?: string | null
  actor_id?: string | null
  actor_email?: string | null
}

export type WalletGate = {
  balance: number | null
  balance_known: boolean
  disable_below: number
  reenable_above: number
  blocked: boolean
  can_assign: boolean
  override: WalletOverride
  /** Set when the override was dropped because the wallet recovered. */
  override_auto_cleared: boolean
  reason: string | null
}

async function getStore(scope: any) {
  const storeModule: any = scope.resolve(Modules.STORE)
  const [store] = await storeModule.listStores({}, { take: 1 })
  return { storeModule, store }
}

async function writeMeta(scope: any, patch: Record<string, any>) {
  const { storeModule, store } = await getStore(scope)
  if (!store) return
  await storeModule.updateStores(store.id, {
    metadata: { ...(store.metadata || {}), ...patch },
  })
}

/**
 * Evaluate the gate and persist any state change.
 *
 * `balance === null` means Shiprocket couldn't be read. That must NOT block —
 * an outage would otherwise halt every order in the building — so an unknown
 * balance leaves the latched state exactly as it was.
 */
export async function evaluateWalletGate(
  scope: any,
  balance: number | null
): Promise<WalletGate> {
  const { store } = await getStore(scope)
  const meta = (store?.metadata as any) || {}

  const prevBlock: WalletBlock = meta[BLOCK_KEY] || { blocked: false }
  let override: WalletOverride = meta[OVERRIDE_KEY] || { active: false }

  let blocked = prevBlock.blocked
  let overrideAutoCleared = false

  if (typeof balance === "number") {
    if (balance < DISABLE_BELOW) {
      blocked = true
    } else if (balance >= REENABLE_ABOVE) {
      // Genuinely refilled — drop the latch AND any manual override, since the
      // override only ever existed to work around this block.
      blocked = false
      if (override.active) {
        override = { active: false }
        overrideAutoCleared = true
      }
    }
    // Between the two thresholds: keep whatever state we were already in.
  }

  const patch: Record<string, any> = {}
  if (blocked !== prevBlock.blocked || balance !== prevBlock.last_balance) {
    patch[BLOCK_KEY] = {
      blocked,
      since: blocked
        ? prevBlock.blocked
          ? prevBlock.since ?? new Date().toISOString()
          : new Date().toISOString()
        : null,
      last_balance: balance,
    }
  }
  if (overrideAutoCleared) patch[OVERRIDE_KEY] = override

  if (Object.keys(patch).length) {
    try {
      await writeMeta(scope, patch)
    } catch {
      // Persisting the latch is best-effort; the gate still works this request.
    }
  }

  const canAssign = !blocked || override.active

  return {
    balance,
    balance_known: typeof balance === "number",
    disable_below: DISABLE_BELOW,
    reenable_above: REENABLE_ABOVE,
    blocked,
    can_assign: canAssign,
    override,
    override_auto_cleared: overrideAutoCleared,
    reason: canAssign
      ? null
      : `Shiprocket wallet is ${
          typeof balance === "number" ? `₹${balance}` : "low"
        }. Courier assignment is disabled until it is topped up past ₹${REENABLE_ABOVE} — ` +
        `an attempt now would fail and may still be charged.`,
  }
}

export async function setWalletOverride(
  scope: any,
  value: WalletOverride
): Promise<void> {
  await writeMeta(scope, { [OVERRIDE_KEY]: value })
}

/** Cheap read for the assignment guard — no Shiprocket call. */
export async function walletAssignmentAllowed(scope: any): Promise<{
  allowed: boolean
  blocked: boolean
  override: boolean
  last_balance: number | null
}> {
  try {
    const { store } = await getStore(scope)
    const meta = (store?.metadata as any) || {}
    const block: WalletBlock = meta[BLOCK_KEY] || { blocked: false }
    const override: WalletOverride = meta[OVERRIDE_KEY] || { active: false }
    return {
      allowed: !block.blocked || override.active,
      blocked: !!block.blocked,
      override: !!override.active,
      last_balance: block.last_balance ?? null,
    }
  } catch {
    return { allowed: true, blocked: false, override: false, last_balance: null }
  }
}
