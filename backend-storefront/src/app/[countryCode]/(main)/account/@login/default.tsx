import LoginTemplate from "@modules/account/templates/login-template"

/**
 * Fallback for the @login parallel slot. Account subroutes (e.g.
 * /account/wishlist, /account/orders) only exist in the @dashboard slot, so
 * without this default the @login slot can't resolve them and Next.js 404s the
 * whole route when a logged-out user lands there directly (e.g. the header
 * wishlist icon). Rendering the login view here means logged-out visitors get
 * the sign-in form, then land on the page they wanted after authenticating.
 */
export default function LoginDefault() {
  return <LoginTemplate />
}
