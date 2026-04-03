import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getOnboardingStatus } from "@/lib/onboarding"

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/auth/signin")
  }

  const status = await getOnboardingStatus(session.user.tenantId)

  if (!status) {
    redirect("/dashboard")
  }

  redirect(status.nextRoute)
}
