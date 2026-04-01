import { redirect } from "next/navigation"

function normalizeCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl || !callbackUrl.startsWith("/")) {
    return "/"
  }

  return callbackUrl
}

export default function AuthSignOutPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string }
}) {
  const callbackUrl = normalizeCallbackUrl(searchParams?.callbackUrl)
  const query = callbackUrl === "/" ? "" : `?callbackUrl=${encodeURIComponent(callbackUrl)}`

  redirect(`/logout${query}`)
}
