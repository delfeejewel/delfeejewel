import { Metadata } from "next"
import { BRAND } from "@lib/constants.brand"
import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: `Sign In or Create Account | ${BRAND.meta.productSuffix}`,
  description: `Sign in to your ${BRAND.name} account or create a new one. Access order tracking, saved addresses, wishlists, and an enhanced shopping experience.`,
}

export default function Login() {
  return <LoginTemplate />
}
