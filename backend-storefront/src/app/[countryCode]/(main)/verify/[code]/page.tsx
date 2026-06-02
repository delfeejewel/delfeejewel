import { Metadata } from "next"

import { verifyQrCode } from "@lib/data/verify"
import VerifyTemplate from "@modules/qr/templates/verify-template"

type Props = { params: Promise<{ code: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  const r = await verifyQrCode(code)
  return {
    title: r.verified
      ? `Verified · ${r.product?.title || "Authentic"}`
      : "Code not recognised",
    description: r.verified
      ? `${r.product?.title} — verified authentic Delfee piece.`
      : "We couldn't verify this code as authentic Delfee.",
    robots: { index: false, follow: false },
  }
}

export default async function VerifyPage({ params }: Props) {
  const { code } = await params
  const data = await verifyQrCode(code)
  return <VerifyTemplate data={data} />
}
