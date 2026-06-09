import { defineWidgetConfig } from "@medusajs/admin-sdk"

import { DELFEE_LOGO } from "./delfee-logo"

/**
 * Delfee branding + storefront theming for the admin login page
 * (zone: login.before).
 *
 * Medusa's login card is a flex column: [logo box] → [title+hint] → [form area
 * (login.before widgets + form)]. Our widget renders at the top of the form
 * area. We hide Medusa's own logo box and "Welcome / Sign in" title+hint (both
 * are the card's direct `mb-4` children, uniquely under the `max-w-[280px]`
 * card) and render just the Delfee wordmark + tagline above the form.
 *
 * Colours: keep Medusa's dark login background with storefront accents (gold
 * rule, silver tagline) and the Outfit font. The "Continue with Email" button
 * is a primary button, so it picks up the storefront plum from the admin-wide
 * theme (admin-theme.ts) automatically — no override needed here. Scoped to the
 * login page container (.min-h-dvh.w-dvw) so the rest of the admin is untouched.
 */
const GOLD = "#D4AF37"
const SILVER = "#8E9196"

const LOGIN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Wittgenstein:wght@400;600;700&display=swap');

/* Storefront font, scoped to the login page. */
.min-h-dvh.w-dvw{font-family:'Outfit',sans-serif !important;}

/* Hide Medusa's default logo box + title/hint. */
.max-w-\\[280px\\] > .mb-4{display:none !important;}
`

const LoginBranding = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        marginBottom: 24,
      }}
    >
      <style>{LOGIN_CSS}</style>

      {/* Logo (white wordmark, for the dark login background) */}
      <img
        src={DELFEE_LOGO}
        alt="Delfee"
        style={{ height: 40, width: "auto", objectFit: "contain" }}
      />

      {/* Gold rule */}
      <div
        style={{
          width: 64,
          height: 2,
          marginTop: 14,
          background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
        }}
      />

      {/* Tagline */}
      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: SILVER,
        }}
      >
        Handcrafted Fine Jewellery
      </div>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "login.before",
})

export default LoginBranding
