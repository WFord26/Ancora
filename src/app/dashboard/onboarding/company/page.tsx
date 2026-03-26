"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Loader2 } from "lucide-react"
import OnboardingLayout from "@/components/onboarding/onboarding-layout"
import { COMMON_TIMEZONES, DEFAULT_TIMEZONE } from "@/lib/timezone-options"

export default function CompanySetupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/settings")
        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (data?.data?.timezone) {
          setTimezone(data.data.timezone)
        }
      } catch (err) {
        console.error("Failed to load tenant settings:", err)
      }
    }

    loadSettings()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/tenants/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update settings")
      }

      // Move to next step
      router.push("/dashboard/onboarding/client")
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OnboardingLayout currentStep={1} totalSteps={5}>
      <CardHeader>
        <CardTitle>Company Setup</CardTitle>
        <CardDescription>
          Let's start by configuring your company timezone so invoices and billing are calculated correctly
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex gap-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-medium text-sm text-slate-300">Business Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="timezone">Primary Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">
                This is used for billing period calculations and invoice timestamps
              </p>
            </div>

            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
              <p className="text-sm text-blue-200">
                <strong>💡 Tip:</strong> Choose the timezone where you operate. This affects when billing periods start and end each month.
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard")}
            >
              Skip for Now
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </OnboardingLayout>
  )
}
