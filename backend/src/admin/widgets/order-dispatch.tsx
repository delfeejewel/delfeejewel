import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Select,
  Text,
  Tooltip,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

/**
 * Dispatch — the whole packing flow for one order, on the order page.
 *
 * A strict vertical hierarchy: each step unlocks only when the one above is
 * satisfied, because every step maps to a physical action and doing them out of
 * order causes real failures (a box taped shut before the invoice goes in, a
 * label printed for a courier that was later reassigned, a van called for a
 * parcel nobody packed).
 *
 * Two kinds of control, and the difference is not cosmetic:
 *   - Checkbox = an attestation. The packer asserts a physical fact. No side
 *     effect, reversible, and unticking cascades to later steps.
 *   - Button = an action. It calls Shiprocket or a printer and costs something.
 *     Confirmed, never auto-retried, failures shown against that step.
 *
 * The hierarchy itself lives server-side in lib/packing-steps and arrives in
 * the `steps` payload — this component renders it rather than deciding for
 * itself, so the UI and the endpoints enforcing it can never disagree.
 */

type StepId =
  | "started"
  | "items_packed"
  | "gift_wrapped"
  | "awb_assigned"
  | "label_printed"
  | "label_pasted"
  | "invoice_printed"
  | "invoice_added"
  | "parcel_sealed"
  | "ready_to_ship"
  | "handed_over"

type Step = {
  id: StepId
  kind: "action" | "attestation"
  label: string
  applicable: boolean
  done: boolean
  at: string | null
  blockedBy: string | null
}

type Detail = {
  simulate: boolean
  id: string
  display_id: number
  fulfillment_status: string
  gift_wrap: boolean
  gift_wrappers_used: number | null
  items: {
    id: string
    title: string
    variant_title: string | null
    variant_sku?: string | null
    quantity: number
    packed: boolean
    product_handle?: string
  }[]
  steps: { steps: Step[]; nextStep: StepId | null; complete: boolean }
  packing: { fulfillment_id: string } | null
  fulfillment: {
    id: string
    awb_code: string | null
    courier_name: string | null
    label_url: string | null
    tracking_url: string | null
    pickup_requested_at: string | null
    pickup_scheduled_date: string | null
    shipped_at: string | null
  } | null
}

type Wallet = {
  balance: number | null
  balance_known: boolean
  disable_below: number
  reenable_above: number
  blocked: boolean
  can_assign: boolean
  override: { active: boolean; actor_email?: string | null; at?: string | null }
  override_auto_cleared: boolean
  reason: string | null
}

const SERVICE_HANDLES = ["gift-wrap", "cod-fee"]

async function api(path: string, opts?: RequestInit) {
  const r = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) {
    // Surface the server's actual reason — "Do this first: Print label",
    // "Shiprocket wallet is ₹40", "no serviceable courier". A generic
    // "something went wrong" is useless on a packing bench.
    throw new Error(body?.message || `Request failed (${r.status})`)
  }
  return body
}

const fmt = (iso: string | null) => {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return ""
  }
}

const OrderDispatch = ({ data }: { data: { id: string } }) => {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [manifest, setManifest] = useState<{ count: number } | null>(null)
  const [status, setStatus] = useState<{
    status: string | null
    status_at: string | null
    courier: string | null
    delivered_at: string | null
    history: { status: string; at: string | null }[]
  } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  /** Errors are keyed BY STEP so each failure appears against the step that
   *  caused it, not as one vague banner at the top of the card. */
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [wrappers, setWrappers] = useState("1")

  const load = useCallback(async () => {
    try {
      const d = await api(`/admin/packing/orders/${data.id}`)
      setDetail(d)
      if (d?.gift_wrappers_used) setWrappers(String(d.gift_wrappers_used))
    } catch (e: any) {
      setErrors((s) => ({ ...s, _load: e.message }))
    }
  }, [data.id])

  const loadWallet = useCallback(async (force = false) => {
    try {
      setWallet(await api(`/admin/shiprocket/wallet${force ? "?force=true" : ""}`))
    } catch {
      // Wallet is advisory. If it can't be read we simply don't block.
      setWallet(null)
    }
  }, [])

  const loadManifest = useCallback(async () => {
    try {
      setManifest(await api(`/admin/shiprocket/manifest`))
    } catch {
      setManifest(null)
    }
  }, [])

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await api(`/admin/orders/${data.id}/shipment-status`))
    } catch {
      setStatus(null)
    }
  }, [data.id])

  useEffect(() => {
    load()
    loadWallet()
    loadManifest()
    loadStatus()
  }, [load, loadWallet, loadManifest, loadStatus])

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key)
    setErrors((s) => ({ ...s, [key]: undefined }))
    try {
      await fn()
      await load()
    } catch (e: any) {
      setErrors((s) => ({ ...s, [key]: e.message }))
    } finally {
      setBusy(null)
    }
  }

  if (!detail) {
    return (
      <Container className="p-0 divide-y">
        <div className="px-6 py-4">
          <Heading level="h2">Dispatch</Heading>
          {errors._load && (
            <Text size="small" className="text-ui-fg-error mt-2">
              {errors._load}
            </Text>
          )}
        </div>
      </Container>
    )
  }

  const steps = detail.steps?.steps || []
  const step = (id: StepId) => steps.find((s) => s.id === id)
  const applicable = steps.filter((s) => s.applicable)
  const doneCount = applicable.filter((s) => s.done).length
  const fid = detail.packing?.fulfillment_id
  const merch = detail.items.filter(
    (i) => !SERVICE_HANDLES.includes(i.product_handle || "")
  )

  /** One row: number, state dot, label, control, timestamp, and its own error. */
  const StepRow = ({
    id,
    children,
    hint,
  }: {
    id: StepId
    children?: React.ReactNode
    hint?: string
  }) => {
    const s = step(id)
    if (!s || !s.applicable) return null
    const locked = !!s.blockedBy && !s.done
    return (
      <div className="py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <span className="mt-0.5">
              {s.done ? "✅" : locked ? "⬜" : "🔵"}
            </span>
            <div className="min-w-0">
              <Text
                size="small"
                weight={s.done ? "regular" : "plus"}
                className={locked ? "text-ui-fg-muted" : undefined}
              >
                {s.label}
              </Text>
              {hint && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {hint}
                </Text>
              )}
              {locked && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  {s.blockedBy}
                </Text>
              )}
              {s.at && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {fmt(s.at)}
                </Text>
              )}
            </div>
          </div>
          <div className="shrink-0">{!locked && children}</div>
        </div>
        {errors[id] && (
          <Text size="xsmall" className="text-ui-fg-error mt-1 pl-6">
            {errors[id]}
          </Text>
        )}
      </div>
    )
  }

  const attest = (id: StepId, done: boolean, extra?: Record<string, any>) =>
    run(id, () =>
      api(`/admin/packing/orders/${data.id}/steps`, {
        method: "POST",
        body: JSON.stringify({ step: id, done, ...extra }),
      })
    )

  const shiprocket = (action: string, key: StepId) =>
    run(key, async () => {
      const r = await api(
        `/admin/orders/${data.id}/fulfillments/${fid}/shiprocket`,
        { method: "POST", body: JSON.stringify({ action }) }
      )
      if (action === "generate_label" && r?.label_url) {
        window.open(r.label_url, "_blank", "noopener")
      }
      await loadWallet(true)
      return r
    })

  const walletBlocks =
    !!wallet && !wallet.can_assign && !step("awb_assigned")?.done

  return (
    <Container className="p-0 divide-y">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Heading level="h2">Dispatch</Heading>
          {detail.simulate && (
            <Badge size="2xsmall" color="orange">
              Simulated
            </Badge>
          )}
        </div>
        <Badge size="2xsmall" color={detail.steps?.complete ? "green" : "grey"}>
          {doneCount} of {applicable.length}
        </Badge>
      </div>

      {/* Wallet — shown only when it actually matters, i.e. before the AWB */}
      {wallet && !step("awb_assigned")?.done && (
        <div className="px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Text size="small" weight="plus">
                Shiprocket wallet:{" "}
                {wallet.balance_known ? `₹${wallet.balance}` : "unknown"}
                {wallet.blocked && (
                  <Badge size="2xsmall" color="red" className="ml-2">
                    Assignment disabled
                  </Badge>
                )}
              </Text>
              {wallet.reason && (
                <Text size="xsmall" className="text-ui-fg-error">
                  {wallet.reason}
                </Text>
              )}
              {wallet.blocked && !wallet.reason && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Disabled below ₹{wallet.disable_below}; re-enables
                  automatically once the balance passes ₹{wallet.reenable_above}.
                </Text>
              )}
              {wallet.override?.active && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Override on by {wallet.override.actor_email || "an admin"} —
                  clears itself once the balance passes ₹{wallet.reenable_above}.
                </Text>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="small"
                variant="transparent"
                onClick={() => loadWallet(true)}
              >
                Refresh
              </Button>
              {wallet.blocked && (
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() =>
                    run("wallet", async () => {
                      await api(`/admin/shiprocket/wallet`, {
                        method: "POST",
                        body: JSON.stringify({
                          override: !wallet.override?.active,
                        }),
                      })
                      await loadWallet(true)
                    })
                  }
                >
                  {wallet.override?.active ? "Disable override" : "Override"}
                </Button>
              )}
            </div>
          </div>
          {errors.wallet && (
            <Text size="xsmall" className="text-ui-fg-error mt-1">
              {errors.wallet}
            </Text>
          )}
        </div>
      )}

      <div className="px-6 divide-y">
        <StepRow id="started">
          <Button
            size="small"
            isLoading={busy === "started"}
            onClick={() =>
              run("started", () =>
                api(`/admin/packing/orders/${data.id}/start`, { method: "POST" })
              )
            }
          >
            Start packing
          </Button>
        </StepRow>

        {/* Items — variant AND sku, because "Kite Solitaire Ring" alone is
            unpackable when three sizes exist. */}
        <div className="py-3">
          <Text size="small" weight="plus" className="mb-2">
            {step("items_packed")?.done ? "✅" : "🔵"} Pick &amp; verify items
            <span className="text-ui-fg-subtle">
              {" "}
              — {merch.filter((i) => i.packed).length} of {merch.length} packed
            </span>
          </Text>
          <div className="flex flex-col gap-2 pl-6">
            {merch.map((it) => (
              <label key={it.id} className="flex items-center gap-2">
                <Checkbox
                  checked={it.packed}
                  disabled={!step("started")?.done || busy === it.id}
                  onCheckedChange={(v) =>
                    run(it.id, () =>
                      api(
                        `/admin/packing/orders/${data.id}/items/${it.id}`,
                        {
                          method: "POST",
                          body: JSON.stringify({ packed: !!v }),
                        }
                      )
                    )
                  }
                />
                <Text size="small">
                  {it.title}
                  {it.variant_title ? ` · ${it.variant_title}` : ""}
                  {it.variant_sku ? ` · ${it.variant_sku}` : ""}
                  <span className="text-ui-fg-subtle"> ×{it.quantity}</span>
                </Text>
              </label>
            ))}
            {merch.map(
              (it) =>
                errors[it.id] && (
                  <Text key={`e-${it.id}`} size="xsmall" className="text-ui-fg-error">
                    {it.title}: {errors[it.id]}
                  </Text>
                )
            )}
          </div>
        </div>

        <StepRow id="gift_wrapped" hint="Gift wrap was purchased for this order">
          <div className="flex items-center gap-2">
            <Select value={wrappers} onValueChange={setWrappers}>
              <Select.Trigger className="w-20">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {["1", "2", "3"].map((n) => (
                  <Select.Item key={n} value={n}>
                    {n}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Checkbox
              checked={!!step("gift_wrapped")?.done}
              disabled={busy === "gift_wrapped"}
              onCheckedChange={(v) =>
                attest("gift_wrapped", !!v, {
                  gift_wrappers_used: Number(wrappers) || 1,
                })
              }
            />
          </div>
        </StepRow>

        <StepRow
          id="awb_assigned"
          hint={
            detail.fulfillment?.courier_name
              ? `${detail.fulfillment.courier_name} · AWB ${detail.fulfillment.awb_code}`
              : "Picks the most reliable serviceable courier"
          }
        >
          {walletBlocks ? (
            <Tooltip content={wallet?.reason || "Wallet too low"}>
              <span>
                <Button size="small" disabled>
                  Assign courier
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button
              size="small"
              isLoading={busy === "awb_assigned"}
              onClick={() => shiprocket("assign_awb", "awb_assigned")}
            >
              Assign courier
            </Button>
          )}
        </StepRow>

        <StepRow id="label_printed">
          <div className="flex gap-2">
            <Button
              size="small"
              variant="secondary"
              isLoading={busy === "label_printed"}
              onClick={() => shiprocket("generate_label", "label_printed")}
            >
              {step("label_printed")?.done ? "Reprint" : "Print label"}
            </Button>
            {detail.fulfillment?.label_url && (
              <Button
                size="small"
                variant="transparent"
                onClick={() =>
                  window.open(detail.fulfillment!.label_url!, "_blank", "noopener")
                }
              >
                Open
              </Button>
            )}
          </div>
        </StepRow>

        <StepRow id="label_pasted">
          <Checkbox
            checked={!!step("label_pasted")?.done}
            disabled={busy === "label_pasted"}
            onCheckedChange={(v) => attest("label_pasted", !!v)}
          />
        </StepRow>

        <StepRow id="invoice_printed">
          <Button
            size="small"
            variant="secondary"
            isLoading={busy === "invoice_printed"}
            onClick={() =>
              run("invoice_printed", async () => {
                await api(`/admin/packing/orders/${data.id}/invoice`, {
                  method: "POST",
                  body: JSON.stringify({ action: "mark_printed" }),
                })
                window.open(
                  `/admin/orders/${data.id}/invoice`,
                  "_blank",
                  "noopener"
                )
              })
            }
          >
            Print invoice
          </Button>
        </StepRow>

        <StepRow id="invoice_added">
          <Checkbox
            checked={!!step("invoice_added")?.done}
            disabled={busy === "invoice_added"}
            onCheckedChange={(v) =>
              run("invoice_added", () =>
                api(`/admin/packing/orders/${data.id}/invoice`, {
                  method: "POST",
                  body: JSON.stringify({ action: "toggle_added", added: !!v }),
                })
              )
            }
          />
        </StepRow>

        <StepRow id="parcel_sealed">
          <Checkbox
            checked={!!step("parcel_sealed")?.done}
            disabled={busy === "parcel_sealed"}
            onCheckedChange={(v) => attest("parcel_sealed", !!v)}
          />
        </StepRow>

        <StepRow
          id="ready_to_ship"
          hint={
            detail.fulfillment?.pickup_scheduled_date
              ? `Pickup scheduled ${detail.fulfillment.pickup_scheduled_date}`
              : "Tells Shiprocket to send a courier"
          }
        >
          <Button
            size="small"
            isLoading={busy === "ready_to_ship"}
            onClick={() =>
              run("ready_to_ship", () =>
                api(`/admin/packing/orders/${data.id}/ready-to-ship`, {
                  method: "POST",
                })
              )
            }
          >
            Mark ready &amp; call pickup
          </Button>
        </StepRow>

        <StepRow id="handed_over" hint="Parcel physically collected by the courier">
          <Checkbox
            checked={!!step("handed_over")?.done}
            disabled={busy === "handed_over"}
            onCheckedChange={(v) => attest("handed_over", !!v)}
          />
        </StepRow>
      </div>

      {/* Manifest — batch-level and optional. Shown once a pickup exists, and
          labelled with the batch size so nobody thinks it's just this parcel. */}
      {step("ready_to_ship")?.done && (
        <div className="px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Text size="small" weight="plus">
                Pickup manifest
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {manifest
                  ? `Covers all ${manifest.count} parcel(s) awaiting pickup, not just this order. Optional — the courier signs it as proof of handover.`
                  : "Optional handover document for the whole pickup batch."}
              </Text>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="small"
                variant="secondary"
                isLoading={busy === "manifest"}
                onClick={() =>
                  run("manifest", async () => {
                    const r = await api(`/admin/shiprocket/manifest`, {
                      method: "POST",
                      body: JSON.stringify({ reprint: false }),
                    })
                    if (r?.manifest_url)
                      window.open(r.manifest_url, "_blank", "noopener")
                    await loadManifest()
                  })
                }
              >
                Generate
              </Button>
              <Button
                size="small"
                variant="transparent"
                onClick={() =>
                  run("manifest", async () => {
                    const r = await api(`/admin/shiprocket/manifest`, {
                      method: "POST",
                      body: JSON.stringify({ reprint: true }),
                    })
                    if (r?.manifest_url)
                      window.open(r.manifest_url, "_blank", "noopener")
                  })
                }
              >
                Reprint
              </Button>
            </div>
          </div>
          {errors.manifest && (
            <Text size="xsmall" className="text-ui-fg-error mt-1">
              {errors.manifest}
            </Text>
          )}
        </div>
      )}

      {/* Live status — after the parcel leaves. The webhook is primary; this is
          the pull path for when one goes missing. */}
      {detail.fulfillment?.awb_code && (
        <div className="px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Text size="small" weight="plus">
                {status?.status || "Awaiting first scan"}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {[
                  status?.courier || detail.fulfillment.courier_name,
                  detail.fulfillment.awb_code,
                  status?.status_at ? `updated ${fmt(status.status_at)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              {status?.delivered_at && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Delivered {fmt(status.delivered_at)}
                </Text>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {detail.fulfillment.tracking_url && (
                <Button
                  size="small"
                  variant="transparent"
                  onClick={() =>
                    window.open(
                      detail.fulfillment!.tracking_url!,
                      "_blank",
                      "noopener"
                    )
                  }
                >
                  Track
                </Button>
              )}
              <Button
                size="small"
                variant="secondary"
                isLoading={busy === "status"}
                onClick={() =>
                  run("status", async () => {
                    const s = await api(
                      `/admin/orders/${data.id}/shipment-status`,
                      { method: "POST" }
                    )
                    setStatus(s)
                  })
                }
              >
                Refresh status
              </Button>
            </div>
          </div>
          {errors.status && (
            <Text size="xsmall" className="text-ui-fg-error mt-1">
              {errors.status}
            </Text>
          )}
          {!!status?.history?.length && (
            <div className="mt-2 flex flex-col gap-0.5">
              {status.history
                .slice(-5)
                .reverse()
                .map((h, i) => (
                  <Text key={i} size="xsmall" className="text-ui-fg-subtle">
                    {h.status} · {fmt(h.at)}
                  </Text>
                ))}
            </div>
          )}
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderDispatch
