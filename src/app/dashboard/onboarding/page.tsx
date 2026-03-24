"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        const response = await fetch("/api/onboarding/status")
        if (!response.ok) {
          // If status check fails, start from company setup
          router.push("/dashboard/onboarding/company")
          return
        }

        const data = await response.json()

        // Redirect to appropriate step
        if (data.completed) {
          router.push("/dashboard")
          return
        }

        // Route to the current step
        const stepRoutes: Record<number, string> = {
          1: "/dashboard/onboarding/company",
          2: "/dashboard/onboarding/client",
          3: "/dashboard/onboarding/retainer",
          4: "/dashboard/onboarding/team",
          5: "/dashboard/onboarding/complete",
        }

        const route = stepRoutes[data.currentStep] || "/dashboard/onboarding/company"
        router.push(route)
      } catch (error) {
        console.error("Error checking onboarding status:", error)
        router.push("/dashboard/onboarding/company")
      } finally {
        setIsLoading(false)
      }
    }

    checkOnboardingStatus()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
        <p className="text-slate-300">Loading your onboarding...</p>
      </div>
    </div>
  )
}
