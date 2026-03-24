import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Ancora Admin",
  description: "System administration dashboard",
}

export default function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
