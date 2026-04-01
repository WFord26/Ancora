import type { Metadata } from "next"
import LogoutPage from "@/components/auth/logout-page"

export const metadata: Metadata = {
  title: "Sign Out | Ancora",
  description: "End your Ancora session",
}

function normalizeCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl || !callbackUrl.startsWith("/")) {
    return "/"
  }

  return callbackUrl
}

export default function LogoutRoute({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string }
}) {
  return <LogoutPage callbackUrl={normalizeCallbackUrl(searchParams?.callbackUrl)} />
}
