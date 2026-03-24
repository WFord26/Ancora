"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Zap, Users, BarChart3, Settings } from "lucide-react"
import OnboardingLayout from "../layout"

export default function OnboardingCompletePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Mark onboarding as complete
    async function completeOnboarding() {
      try {
        await fetch("/api/onboarding/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      } catch (err) {
        console.error("Error completing onboarding:", err)
      } finally {
        setIsLoading(false)
      }
    }

    completeOnboarding()
  }, [])

  return (
    <OnboardingLayout currentStep={5} totalSteps={5}>
      <CardContent className="pt-8">
        <div className="space-y-8">
          {/* Success message */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <CheckCircle2 className="h-20 w-20 text-green-500 animate-pulse" />
                <div className="absolute inset-0 bg-green-500/20 rounded-full animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">You're All Set! 🎉</h2>
              <p className="text-slate-300">
                Your Ancora workspace is ready. Let's get to work!
              </p>
            </div>
          </div>

          {/* What you can do now */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-200">Next Steps</h3>
            <div className="grid gap-3">
              <Link href="/dashboard/time-entries" className="block">
                <div className="p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700/70 transition-colors group cursor-pointer">
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-blue-400 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white group-hover:text-blue-300 transition-colors">
                        Track Time Entries
                      </p>
                      <p className="text-sm text-slate-400">
                        Start logging billable time for your clients
                      </p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/dashboard/clients" className="block">
                <div className="p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700/70 transition-colors group cursor-pointer">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-purple-400 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white group-hover:text-purple-300 transition-colors">
                        Manage Clients
                      </p>
                      <p className="text-sm text-slate-400">
                        Add more clients or edit existing ones
                      </p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/dashboard/reports" className="block">
                <div className="p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700/70 transition-colors group cursor-pointer">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="h-5 w-5 text-green-400 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white group-hover:text-green-300 transition-colors">
                        View Reports
                      </p>
                      <p className="text-sm text-slate-400">
                        Check utilization, profitability, and forecasts
                      </p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/dashboard/settings" className="block">
                <div className="p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700/70 transition-colors group cursor-pointer">
                  <div className="flex items-start gap-3">
                    <Settings className="h-5 w-5 text-orange-400 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white group-hover:text-orange-300 transition-colors">
                        Configure Settings
                      </p>
                      <p className="text-sm text-slate-400">
                        Set up integrations and team management
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 py-4 px-4 bg-slate-700/30 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">∞</div>
              <p className="text-xs text-slate-400 mt-1">Clients</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">∞</div>
              <p className="text-xs text-slate-400 mt-1">Retainers</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">100%</div>
              <p className="text-xs text-slate-400 mt-1">Setup</p>
            </div>
          </div>

          {/* Help text */}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-center">
            <p className="text-sm text-blue-200">
              Need help?  Check out our{" "}
              <a href="https://docs.ancora.app" className="underline hover:no-underline font-medium">
                documentation
              </a>
              {" "}or contact support
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => window.open("https://docs.ancora.app", "_blank")}
            >
              View Docs
            </Button>
            <Button
              onClick={() => {
                router.push("/dashboard")
              }}
              disabled={isLoading}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </CardContent>
    </OnboardingLayout>
  )
}
