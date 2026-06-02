import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { Outfit, Wittgenstein } from "next/font/google"
import "../styles/globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
})

const wittgenstein = Wittgenstein({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-wittgenstein",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-mode="light"
      className={`${outfit.variable} ${wittgenstein.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-outfit antialiased"
        style={{ backgroundColor: "#ffffff", color: "#1a1a1a" }}
      >
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
