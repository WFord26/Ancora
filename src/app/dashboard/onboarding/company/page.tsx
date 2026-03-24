"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AddressForm } from "@/components/address-form"
import { AlertCircle, Loader2 } from "lucide-react"
import OnboardingLayout from "../layout"

// Common IANA timezones
const TIMEZONES = [
  // Americas
  { label: "America/Anchorage", group: "Americas" },
  { label: "America/Chicago", group: "Americas" },
  { label: "America/Denver", group: "Americas" },
  { label: "America/Los_Angeles", group: "Americas" },
  { label: "America/New_York", group: "Americas" },
  { label: "America/Toronto", group: "Americas" },
  { label: "America/Vancouver", group: "Americas" },
  { label: "UTC", group: "Other" },
]

export default function CompanySetupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [timezone, setTimezone] = useState("America/Denver")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
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
                  <SelectItem value="America/Denver">Denver - Mountain Time (America/Denver)</SelectItem>
                  <SelectItem value="America/Chicago">Chicago - Central Time (America/Chicago)</SelectItem>
                  <SelectItem value="America/New_York">New York - Eastern Time (America/New_York)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Los Angeles - Pacific Time (America/Los_Angeles)</SelectItem>
                  <SelectItem value="Europe/London">London - GMT/BST (Europe/London)</SelectItem>
                  <SelectItem value="Europe/Berlin">Berlin - CET/CEST (Europe/Berlin)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo - JST (Asia/Tokyo)</SelectItem>
                  <SelectItem value="Australia/Sydney">Sydney - AEDT (Australia/Sydney)</SelectItem>
                  <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
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
