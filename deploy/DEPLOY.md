# Deploy checklist — runtime setup

Pushing to `main` rebuilds + redeploys the code (see `CICD-SETUP.md`). But some
things live **outside the code** and must be set by hand in production, or
features ship dark. This is that list.

> The droplet's `backend.env` (`/opt/delfee/backend.env`) is **not** in git and is
> **not** overwritten by deploys — you edit it on the server. The repo `.env` is
> local-only; values there do **not** reach production.

Droplet: `root@168.144.24.176`, app dir `/opt/delfee`.

---

## 1. Backend runtime env (`/opt/delfee/backend.env`)

SSH in and make sure these are set (not the placeholders):

```bash
ssh root@168.144.24.176
cd /opt/delfee && nano backend.env
```

| Key | Value | Why it matters |
|---|---|---|
| `STOREFRONT_URL` | `https://www.delfee.in` | ⚠️ Email "Track order" link + **logo** + invoice links. If left as `yourdomain.com`, **every order email is broken**. |
| `RAZORPAY_WEBHOOK_SECRET` | the secret from the Razorpay dashboard (step 2) | Webhook signature check. Wrong/placeholder → reconciliation is off (route returns 500). |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | `rzp_live_…` at launch | Real charges. Test keys only take test payments. |
| `COD_UPFRONT_PERCENT` | `10` | COD token = 10% above ₹2000. *(Code default already 10 — optional to set.)* |
| `COD_UPFRONT_THRESHOLD` | `2000` | Below this → flat token. *(Default 2000.)* |
| `COD_UPFRONT_FLAT` | `200` | Flat token below threshold. *(Default 200.)* |

Generate a webhook secret if you need one:

```bash
openssl rand -hex 32
```

---

## 2. Razorpay dashboard — webhook

Dashboard → **Settings → Webhooks → Add New Webhook**

- **URL:** `https://api.delfee.in/hooks/razorpay`
- **Active events:** `payment.captured`
- **Secret:** the **same** value you put in `RAZORPAY_WEBHOOK_SECRET` (must match exactly, or every webhook fails with 401)

Do this in **both** Razorpay test and live modes (each has its own webhooks +
secret) and keep the env secret in sync with whichever mode the keys are in.

---

## 3. Restart the backend (picks up env)

Env + middleware changes only load at boot:

```bash
cd /opt/delfee && docker compose up -d --force-recreate backend
```

---

## 4. Verify

```bash
# Webhook configured? (expect 400 "Missing signature", NOT 500 "not configured")
curl -i -X POST https://api.delfee.in/hooks/razorpay -H 'Content-Type: application/json' -d '{}'
```

- Place a test order → confirmation email shows the **logo + correct track link** (not yourdomain).
- COD order ≥ ₹2000 → checkout shows the **10% advance token**; order/email/track show "Advance paid / Due on delivery".
- Razorpay dashboard → the webhook delivery shows **200**; backend logs show
  `Razorpay webhook: payment … cart … -> already_order` (or `-> completed`).
- Admin → **Payments to Review** is empty (or lists any genuinely stuck payment);
  the Orders list shows the alert banner only when something needs review.

---

## Already handled (no action)

- `cms_store_info` support email → `enquire@delfee.in` (done directly in Supabase, shared by prod).
- `otp_code` table → already migrated in the shared Supabase DB.
- No new DB migrations were introduced.

## Still a placeholder (by choice)

- Store **phone / WhatsApp** in `cms_store_info` is `+919876543210` — update it
  (CMS store settings, or the `cms_store_info` table) before launch so the
  call/WhatsApp links work.
