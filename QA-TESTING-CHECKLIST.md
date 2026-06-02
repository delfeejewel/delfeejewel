# E-Commerce QA Testing Roadmap & Checklist

End-to-end test plan for the Delfee storefront (Next.js) + Medusa v2 backend.

**How to use this doc:** Work top to bottom. The roadmap phases are ordered by dependency — environment must be green before anything else, and the happy-path purchase must work before edge cases are worth testing. Each check has a **Do** (action) and **Expect** (pass criteria). Mark `[x]` as you go and note the build/commit you tested against.

| Field | Value |
|---|---|
| Tested by | |
| Date | |
| Backend commit | |
| Storefront commit | |
| Environment | ☐ Local ☐ Staging ☐ Production |

---

## Roadmap (test in this order)

```
Phase 0  Environment & smoke ........ services up, DB seeded, regions load
Phase 1  Browsing & discovery ....... home, listing, PDP, search, categories
Phase 2  Cart ....................... add/update/remove, gift wrap, discounts
Phase 3  Checkout happy path ........ address → shipping → payment → review
Phase 4  Payments ................... Razorpay, COD + upfront, gift card credit
Phase 5  Order lifecycle ............ confirmation, emails, ops status, tracking
Phase 6  Account .................... auth, profile, addresses, wishlist, orders
Phase 7  Returns & exchanges ........ request, window rules, approve, replacement
Phase 8  Reviews .................... submit, moderation, public display
Phase 9  Jewelry-specific ........... QR authenticity, gift cards, invoices
Phase 10 Background jobs ............ abandoned cart, review request, low stock
Phase 11 Fulfillment ................ Shiprocket create/track/webhook
Phase 12 Cross-cutting .............. regions, coming-soon, SEO, mobile, errors
```

**Critical path (must all pass before launch):** Phase 0 → 1 → 2 → 3 → 4 → 5. Everything else is important but a blocker in Phases 7–11 is not a launch blocker the way a broken checkout is.

---

## Phase 0 — Environment & Smoke

- [ ] **Backend boots** — `cd backend && npm run dev` → server listens on `:9000`, no module-registration errors in logs.
- [ ] **Storefront boots** — `cd backend-storefront && npm run dev` → serves on `:8000`.
- [ ] **DB migrated** — `npx medusa db:migrate` runs clean; custom tables exist: `gift_card`, `product_review`, `wishlist_item`, `qr_code`, `return_request`, `return_request_item`, `contact_message`.
- [ ] **Seed data present** — India region (INR), Mumbai warehouse, sales channel, publishable key, gift-card product, gift-wrap product (`GIFT-WRAP-INR-50`).
- [ ] **Admin reachable** — `/app` loads (unless `DISABLE_ADMIN=true`); can log in with seeded admin.
- [ ] **Publishable key wired** — storefront `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` matches backend; no 401s on product fetch.
- [ ] **Region redirect** — visiting `/` redirects to `/in` (or `NEXT_PUBLIC_DEFAULT_REGION`). No redirect loop.
- [ ] **CORS** — storefront calls succeed; no CORS errors in browser console for `STORE_CORS` origin.
- [ ] **Env secrets set** — Razorpay keys, Shiprocket creds, CMS email sender, `JWT_SECRET`, `COOKIE_SECRET` all populated for the environment under test.

---

## Phase 1 — Browsing & Discovery

### Home `/[cc]/`
- [ ] Hero carousel renders and auto-advances; arrows/dots work.
- [ ] Category grid, promo banners, featured carousel, occasion/gender sections all load (CMS-driven content present).
- [ ] Testimonials, brand story, Instagram feed, trust signals render without layout breaks.
- [ ] Mobile bottom nav appears on small viewport.
- [ ] No console errors; all images load (no broken `alt`-only boxes).

### Product listing `/[cc]/store`
- [ ] Grid loads with thumbnails + prices in INR.
- [ ] **Sort** — price (low/high), newest, rating, popularity each reorder results correctly.
- [ ] **Filter** — category/tag filters narrow results; clearing restores full set.
- [ ] Pagination / infinite scroll loads next page; no duplicate items.
- [ ] Quick add-to-cart from listing works.

### Product detail `/[cc]/products/[handle]`
- [ ] Gallery: main image + thumbnails switch correctly.
- [ ] **Variant selection** — size/color updates price + availability; unavailable combos disabled.
- [ ] Stock indicator accurate (in stock / low / out of stock).
- [ ] Quantity selector clamps to available inventory.
- [ ] Add to cart → cart count increments, drawer/toast confirms.
- [ ] Wishlist heart toggles (saves if logged in; prompts login if guest).
- [ ] Related products + recently-viewed render.
- [ ] Reviews section shows average + breakdown; "verified purchase" reviews visible.
- [ ] Mobile sticky add-to-cart bar appears on scroll.
- [ ] **SEO** — JSON-LD Product + BreadcrumbList present in page source; OG tags set.

### Categories `/[cc]/categories/[...category]`
- [ ] Parent/child hierarchy navigates correctly; breadcrumb accurate.
- [ ] Category-filtered listing + sort + pagination work.

### Collections `/[cc]/collections/[handle]`
- [ ] Collection products + title/description render; sort + pagination work.

### Search `/[cc]/search` + `/api/search`
- [ ] Autocomplete suggestions appear as you type.
- [ ] Results match query; query term highlighted.
- [ ] Trending searches show on empty state.
- [ ] Mobile search modal opens/closes; zero-results state is graceful.

---

## Phase 2 — Cart

### Cart page `/[cc]/cart`
- [ ] Items list with thumbnail, variant, unit price, line total.
- [ ] Quantity +/- updates line + subtotal; removing last unit removes line.
- [ ] Remove item works; empty-cart state shows with CTA.
- [ ] Subtotal math correct across multiple items/variants.
- [ ] Guest sees sign-in prompt; cart persists across reload (cookie).

### Gift wrap — `POST /store/carts/:id/gift-wrap`
- [ ] Toggle ON adds `GIFT-WRAP-INR-50` line (+₹50); subtotal updates.
- [ ] Toggle OFF removes the line and the ₹50.
- [ ] `cart.metadata.gift_wrap` flag set (verify in admin/DB).

### Discounts & gift cards (cart-level)
- [ ] Valid discount code applies; total drops; invalid code shows error.
- [ ] Gift card code applies as credit; removing it restores the balance.
- [ ] Stacked discount + gift card compute in correct order.

### Cart recovery `/[cc]/cart/recover/[id]`
- [ ] Recovery deep link restores the cart; item preview + "welcome back" copy show.
- [ ] Expired/invalid recovery id handled gracefully (no crash).

---

## Phase 3 — Checkout Happy Path

Flow: Shipping address → Shipping method → Payment → Billing → Review → Place order.

### Step 1 — Shipping address
- [ ] Guest can enter full address; country/state/city/postal selectors populate.
- [ ] Logged-in user can pick a saved address or add new.
- [ ] Validation blocks incomplete/invalid postal codes.
- [ ] "Billing same as shipping" checkbox carries data forward.

### Step 2 — Shipping method
- [ ] Available methods + costs + ETA listed (Shiprocket-backed or manual).
- [ ] Selecting a method updates order total.
- [ ] No-methods-available state handled (e.g., unsupported pincode).

### Step 3 — Payment method
- [ ] All configured providers appear: Razorpay, COD, (PayPal/manual if enabled).
- [ ] Selecting a provider initiates a payment session without error.
- [ ] Icons/descriptions render via `paymentInfoMap`.

### Step 4 — Billing address
- [ ] Same-as-shipping prefills; distinct billing address accepted.

### Step 5 — Review
- [ ] Full breakdown: subtotal, shipping, tax, discount, gift card, grand total — all correct.
- [ ] Edit links jump back to the right step and preserve data.
- [ ] Apply discount/gift card from review reflects immediately.
- [ ] **Place order** transitions to payment capture then confirmation.

---

## Phase 4 — Payments

### Razorpay (`pp_razorpay_razorpay`)
- [ ] Place order → Razorpay popup opens with correct amount **in paise** (₹X → X×100).
- [ ] Successful UPI/card/wallet payment → signature verified server-side → order placed.
- [ ] Cancelled/failed payment → cart preserved, user can retry, no phantom order.
- [ ] Webhook `payment.captured` marks payment captured; `payment.failed` handled.
- [ ] Refund from admin hits Razorpay refund API and reflects in order.

### COD (`pp_cod_cod`) + upfront
- [ ] `GET /store/cod-policy` returns percent + min_order + currency.
- [ ] Order **below** `COD_UPFRONT_MIN_ORDER` (₹500): plain COD, no upfront popup.
- [ ] Order **at/above** min: `POST /store/cod-upfront/create-razorpay-order` returns razorpay_order_id + key.
- [ ] Upfront amount = min(total × percent, threshold); UPI popup shows correct amount.
- [ ] `POST /store/cod-upfront/verify` validates signature → order placed as COD with upfront paid.
- [ ] Failed upfront payment blocks order placement.

### Gift card as payment/credit
- [ ] Gift card covering **partial** total → remaining due via Razorpay/COD.
- [ ] Gift card covering **full** total → zero balance due, order completes.
- [ ] Gift card balance decremented exactly by amount used (check `gift_card` row).

### Money integrity
- [ ] Amounts consistent across cart → review → Razorpay → order → invoice (no ÷100/×100 drift).
- [ ] Tax and shipping included in captured amount.

---

## Phase 5 — Order Lifecycle

### Confirmation `/[cc]/order/[id]/confirmed`
- [ ] Order number, items recap, payment method, ETA, returns info all show.
- [ ] Guest sees onboarding CTA (claim/transfer order).

### Emails (sender pulled from CMS `cms_store_info` / `cms_email_sender`)
- [ ] `order.placed` email received by customer with correct items + total.
- [ ] If CMS sender **not** configured → email skipped + warning logged (no crash). Then configure sender and re-verify send works.
- [ ] Gift-wrap flag visible to ops where applicable.

### Ops status (admin) — `/admin/orders/:id/ops-status`
- [ ] Status advances pending → picked → packed → shipped → delivered.
- [ ] Backward move rejected unless `allow_skip=true`.
- [ ] Audit history records actor email + timestamp on each change.

### Shipment + tracking
- [ ] `order.shipped` event → shipment email with tracking number.
- [ ] Tracking link/number present on order details.

### Guest order lookup & transfer
- [ ] `/[cc]/track-order` finds order by email/phone (`GET /store/orders/lookup`).
- [ ] Order transfer accept (`/transfer/[token]/accept`) attaches order to account.
- [ ] Transfer decline path works; invalid/expired token handled.

### Invoice
- [ ] `GET /store/orders/:id/invoice` (or `/api/orders/[id]/invoice`) downloads a valid PDF.
- [ ] **GST invoice** (`/admin/orders/:id/invoice`): seller info from CMS, intra- vs inter-state tax correct, HSN codes + rates present.

---

## Phase 6 — Account

### Auth `/[cc]/account`
- [ ] Register (first/last/email/password) creates customer + logs in.
- [ ] Login with valid creds works; wrong password shows error.
- [ ] Password show/hide toggle works; forgot-password link present.
- [ ] Logout clears session; protected pages redirect to login.

### Overview
- [ ] Welcome name, order stats, recent orders preview accurate.
- [ ] Pending-review popup appears when reviews are due.

### Profile `/account/profile`
- [ ] Edit first/last name, email, phone — each saves and persists on reload.
- [ ] Change password works; old password invalidated.

### Addresses `/account/addresses`
- [ ] Add address; appears in list.
- [ ] Edit address (modal) saves changes.
- [ ] Delete address removes it.
- [ ] Set default shipping/billing reflected at checkout.

### Orders `/account/orders` + details
- [ ] Order list shows status, date, total; statuses color-coded.
- [ ] Order details: addresses, items, breakdown, timeline, tracking, invoice download.
- [ ] Reorder button repopulates cart with same items.

### Wishlist `/account/wishlist`
- [ ] Items saved from PDP/listing appear.
- [ ] Add-to-cart from wishlist works; remove works; empty state shows.
- [ ] Wishlist persists across sessions (server-backed via `/store/customers/me/wishlist`).

---

## Phase 7 — Returns & Exchanges

`POST /store/customers/me/return-requests` — window default 15 days from delivery.

### Eligibility & window
- [ ] Delivered order **within** window → return request allowed.
- [ ] Order **past** `RETURN_WINDOW_DAYS` → blocked with clear message.
- [ ] Undelivered order → not eligible.
- [ ] Duplicate open request for same order → blocked.

### Refund return
- [ ] Select items + reason (wrong_size / damaged / quality / changed_mind / etc.) → submits.
- [ ] Appears in `/account/returns` as pending; `return.submitted` email sent.
- [ ] Admin approve (`/admin/return-requests/:id/approve`) → `return.approved` email.
- [ ] Admin reject with reason → `return.rejected` email.
- [ ] Mark-received → refund processed → `return.completed` email; refund amount correct.

### Exchange (same-product variant swap, prices must match)
- [ ] Choosing exchange forces a **different** variant of the **same** product.
- [ ] Variant with **different price** → rejected (must match exactly).
- [ ] Approve → `/admin/return-requests/:id/create-replacement` creates **zero-charge** replacement order.
- [ ] Original order metadata links `replacement_for_order_id` + `return_request_id`.
- [ ] `exchange.submitted` then `replacement.shipped` emails fire at the right steps.

### Returns policy page
- [ ] `/[cc]/returns-and-exchange` renders policy, window, steps, FAQ accurately.

---

## Phase 8 — Reviews

`POST /store/customers/me/reviews` (verified purchase) → moderation → public.

- [ ] Review allowed only for products in a delivered order (order_id verification).
- [ ] One review per (customer, product) — second attempt blocked/edits existing.
- [ ] New review status = pending; **not** shown publicly yet.
- [ ] Admin approve → appears on PDP; reject → stays hidden.
- [ ] `GET /store/reviews?product_id=` returns count, average, per-star breakdown matching displayed data.
- [ ] Review request email (Phase 10 job) deep-links to the review form.
- [ ] Account `/account/reviews`: pending list + submitted list correct; star/photo upload works.

---

## Phase 9 — Jewelry-Specific Features

### QR authenticity `/[cc]/verify/[code]` + `GET /store/qr-verify/:code`
- [ ] Active QR → "Verified Genuine" page with correct product/variant.
- [ ] Voided/unknown QR → clear "not verified" error, no crash.
- [ ] Admin can generate QR codes (`POST /admin/qr-codes`) and print label sheet (`/admin/qr-codes/labels`).

### Gift cards (purchase + redeem)
- [ ] Gift-card PDP: recipient name/email, sender, denomination chips, custom amount, message, send date.
- [ ] Purchase completes → `gift_card.purchased` event → recipient email with code.
- [ ] `GET /store/gift-cards/:code` returns balance/status.
- [ ] Redeem on cart (`POST /store/gift-cards/redeem`) → credit line added, balance decremented.
- [ ] Unapply (`DELETE`) → credit removed, balance restored.
- [ ] Expired gift card rejected.

### Contact form `/[cc]/contact` → `POST /store/contact`
- [ ] Submission stored as `contact_message` (status `new`); WhatsApp/email links work.

---

## Phase 10 — Background Jobs

> Trigger manually or fast-forward timestamps to test without waiting.

### Abandoned cart recovery (hourly)
- [ ] Cart idle 4–72h with items + email + no completed order → recovery email sent.
- [ ] Recovery email contains working `/cart/recover/[id]` URL.
- [ ] Not re-sent once `recovery_sent_at` is set.

### Review request (daily 10:00)
- [ ] Order delivered 1–7 days ago → review request email sent once (`review_email_sent` guard).
- [ ] Too-recent (<1d) or too-old (>7d) orders skipped.

### Low-stock alert
- [ ] Stock below threshold → digest email to admins (`/admin/low-stock/check`).

### Keep-alive
- [ ] Health-check job runs without error (no impact on data).

---

## Phase 11 — Fulfillment (Shiprocket)

- [ ] Checkout shows Shiprocket options (standard/express) with live rates for valid pincode.
- [ ] Order → `createFulfillment` creates Shiprocket shipment; token cached (24h).
- [ ] Webhook `POST /api/hooks/shiprocket` updates order metadata on: picked, packed, shipped, delivered, returned (RTO), failed.
- [ ] `delivered_at` + `tracking_number` set on delivery (drives ops widget + review job).
- [ ] **RTO**: returned event → `/admin/orders/:id/process-rto` refunds + restocks (idempotent — running twice doesn't double-refund); `rto.refund_processed` admin email.
- [ ] Cancel fulfillment path works.

---

## Phase 12 — Cross-Cutting

### Regions & localization
- [ ] Switching country changes currency, pricing, available payment/shipping.
- [ ] Unsupported region handled; default region fallback works.
- [ ] `x-medusa-locale` header sent on requests.

### Coming-soon mode
- [ ] `COMING_SOON_MODE=true` → all storefront routes redirect to `/coming-soon`.
- [ ] `?qa=<TOKEN>` bypasses for QA; wrong token does not.
- [ ] Admin routes still reachable.
- [ ] Newsletter capture on coming-soon (`/api/notify-launch`) stores email.

### SEO & metadata
- [ ] Titles/descriptions/canonical per page; OG + Twitter cards.
- [ ] JSON-LD on PDP (Product) and contact (Organization).
- [ ] `robots.txt` + `sitemap` correct for environment (prod indexable, staging not).

### Responsive & accessibility
- [ ] Mobile, tablet, desktop layouts intact on home, PDP, cart, checkout.
- [ ] Keyboard navigation through checkout; focus states visible.
- [ ] Images have alt text; forms have labels.

### Error & resilience
- [ ] 404 page for bad routes; bad product handle handled.
- [ ] Backend-down → storefront degrades gracefully (no white screen).
- [ ] Out-of-stock at checkout caught before payment.
- [ ] Network failure mid-payment doesn't create an inconsistent order.

### Security (pre-launch)
- [ ] Lock down / remove dev `GET /store/email-test` route.
- [ ] Rotate any leaked PATs/secrets.
- [ ] Razorpay + Shiprocket webhook signatures verified (reject unsigned/forged).
- [ ] Customer-scoped routes (`/store/customers/me/*`) reject other users' data.
- [ ] Admin routes require admin auth.

---

## Sign-off

| Phase | Status | Notes |
|---|---|---|
| 0 Environment | ☐ Pass ☐ Fail | |
| 1 Browsing | ☐ Pass ☐ Fail | |
| 2 Cart | ☐ Pass ☐ Fail | |
| 3 Checkout | ☐ Pass ☐ Fail | |
| 4 Payments | ☐ Pass ☐ Fail | |
| 5 Order lifecycle | ☐ Pass ☐ Fail | |
| 6 Account | ☐ Pass ☐ Fail | |
| 7 Returns/exchanges | ☐ Pass ☐ Fail | |
| 8 Reviews | ☐ Pass ☐ Fail | |
| 9 Jewelry-specific | ☐ Pass ☐ Fail | |
| 10 Background jobs | ☐ Pass ☐ Fail | |
| 11 Fulfillment | ☐ Pass ☐ Fail | |
| 12 Cross-cutting | ☐ Pass ☐ Fail | |

**Launch gate:** Phases 0–5 must be green. Open issues from 6–12 tracked separately.
