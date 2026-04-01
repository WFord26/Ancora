import type { Metadata } from "next"
import MarketingShell from "@/components/marketing/marketing-shell"

export const metadata: Metadata = {
  title: "Ancora - Retainer Management & Time Tracking",
  description: "Streamline IT consulting retainer billing, time tracking, and client management. Track hours, manage rollover, and generate invoices automatically.",
}

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MarketingShell>{children}</MarketingShell>
}
