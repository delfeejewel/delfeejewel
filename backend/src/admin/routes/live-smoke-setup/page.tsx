import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Key } from "@medusajs/icons"
import { Container, Heading, Text, Button, Input, Label } from "@medusajs/ui"
import { useState } from "react"

// ONE-TIME setup page (shows up in the admin nav like any other route, but
// meant to be visited once and then ignored). It charges ₹1 to whatever real
// card you enter, saves it as a reusable Razorpay token, and shows you the
// customer_id/token_id to paste into the droplet's backend.env as
// RAZORPAY_LIVE_SMOKE_CUSTOMER_ID / RAZORPAY_LIVE_SMOKE_TOKEN_ID. Nothing
// here is stored automatically — every backend route behind this page is
// still gated on orders.write, same as the rest of admin.

async function api(path: string, body: any) {
  const r = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(json?.message || `HTTP ${r.status}`)
  return json
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) return resolve()
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Could not load Razorpay checkout.js"))
    document.body.appendChild(script)
  })
}

const LiveSmokeSetupPage = () => {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ customer_id: string; token_id: string } | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      if (!email) throw new Error("Enter a dedicated automation inbox email first")

      const order = await api("/admin/automation/live-smoke/setup/create-order", { email })
      await loadRazorpayScript()

      await new Promise<void>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          order_id: order.order_id,
          name: "Delfee — Live Smoke Test Setup",
          description: "One-time card save for the weekly automated live check",
          recurring: "1",
          customer_id: order.customer_id,
          prefill: { email },
          theme: { color: "#5D2E46" },
          handler: async (response: any) => {
            try {
              const confirmed = await api("/admin/automation/live-smoke/setup/confirm", {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                customer_id: order.customer_id,
              })
              setResult(confirmed)
              resolve()
            } catch (e: any) {
              reject(e)
            }
          },
          modal: { ondismiss: () => reject(new Error("Payment window closed")) },
        })
        rzp.on("payment.failed", (resp: any) =>
          reject(new Error(resp.error?.description || "Payment failed"))
        )
        rzp.open()
      })
    } catch (e: any) {
      setError(e?.message || "Setup failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container>
      <Heading level="h1">Live Smoke Test — One-Time Setup</Heading>
      <Text size="small" style={{ color: "#666", marginTop: 8 }}>
        Charges ₹1 to a real card you enter below, saves it as a reusable Razorpay
        token, and shows the ids to paste into the droplet's <code>backend.env</code>{" "}
        as <code>RAZORPAY_LIVE_SMOKE_CUSTOMER_ID</code> /{" "}
        <code>RAZORPAY_LIVE_SMOKE_TOKEN_ID</code>. Run this once, then ignore this page.
      </Text>

      {!result && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
          <Label htmlFor="automation-email">Dedicated automation inbox email</Label>
          <Input
            id="automation-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="automation@delfee.in"
          />
          <Button onClick={run} disabled={busy}>
            {busy ? "Working…" : "Pay ₹1 and save card"}
          </Button>
        </div>
      )}

      {error && (
        <Text size="small" style={{ color: "#b91c1c", marginTop: 12 }}>
          {error}
        </Text>
      )}

      {result && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 8,
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            maxWidth: 480,
          }}
        >
          <Text size="small" weight="plus">Done. Add these to /opt/delfee/backend.env:</Text>
          <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: "pre-wrap" }}>
{`LIVE_SMOKE_TEST_ENABLED=true
RAZORPAY_LIVE_SMOKE_CUSTOMER_ID=${result.customer_id}
RAZORPAY_LIVE_SMOKE_TOKEN_ID=${result.token_id}`}
          </pre>
          <Text size="small" style={{ color: "#666", marginTop: 8 }}>
            Then restart the backend (<code>docker compose up -d --force-recreate backend</code>)
            for it to pick these up.
          </Text>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Live Smoke Test Setup",
  icon: Key,
})

export default LiveSmokeSetupPage
