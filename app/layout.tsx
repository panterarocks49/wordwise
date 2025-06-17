import type React from "react"
import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Lucid Docs - API Documentation Writing Assistant",
  description: "A Grammarly-style writing assistant specifically designed for API documentation writers",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={geist.className}>{children}</body>
    </html>
  )
}
