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
import { AlertCircle, Loader2, Zap, ArrowRight } from "lucide-react"
import OnboardingLayout from "../layout"

const TIMEZONES = [
  { label: "America/Anchorage", group: "Americas" },
  { label: "America/Chicago", group: "Americas" },
  { label: "America/Denver", group: "Americas" },
  { label: "America/Los_Angeles", group: "Americas" },
  { label: "America/New_York", group: "Americas" },
  { label: "America/Toronto", group: "Americas" },
  { label: "Europe/London", group: "Europe" },
  { label: "Europe/Berlin", group: "Europe" },
  { label: "Asia/Tokyo", group: "Asia" },
  { label: "Australia/Sydney", group: "Pacific" },
  { label: "UTC", group: "Other" },
]

export default function ClientSetupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [clientTimezone, setClientTimezone] = useState("America/Denver")
  const [skipClient, setSkipClient] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (skipClient) {
        router.push("/dashboard/onboarding/retainer")
        return
      }

      const formData = new FormData(e.currentTarget)
      const data = {
        companyName: formData.get("companyName") as string,
        primaryContactName: formData.get("primaryContactName") as string || null,
        email: formData.get("email") as string || null,
        phone: formData.get("phone") as string || null,
        addressLine1: formData.get("addressLine1") as string || null,
        addressLine2: formData.get("addressLine2") as string || null,
        city: formData.get("city") as string || null,
        state: formData.get("state") as string || null,
        zipCode: formData.get("zipCode") as string || null,
        billingEmail: formData.get("billingEmail") as string || null,
        timezone: clientTimezone,
      }

      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create client")
      }

      router.push("/dashboard/onboarding/retainer")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <OnboardingLayout currentStep={2} totalSteps={5}>
      <CardHeader>
        <CardTitle>Create Your First Client</CardTitle>
        <CardDescription>
          Add a client or skip this step if you need to create clients later
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

          {!skipClient ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  required
                  placeholder="Acme Corporation"
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="primaryContactName">Primary Contact Name</Label>
                <Input
                  id="primaryContactName"
                  name="primaryContactName"
                  placeholder="John Doe"
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@acme.com"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <AddressForm />

              <div>
                <Label htmlFor="billingEmail">Billing Email</Label>
                <Input
                  id="billingEmail"
                  name="billingEmail"
                  type="email"
                  placeholder="billing@acme.com"
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="clientTimezone">Client Timezone</Label>
                <Select value={clientTimezone} onValueChange={setClientTimezone}>
                  <SelectTrigger id="clientTimezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.label} value={tz.label}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                <p className="text-sm text-blue-200">
                  <strong>💡 Tip:</strong> You can always add more clients from the Clients page or skip this now.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-4">
              <div className="text-5xl">📋</div>
              <div>
                <p className="font-medium">No problem!</p>
                <p className="text-sm text-slate-400">You can create clients anytime from the dashboard</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-between flex-wrap">
            <div>
              {!skipClient && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSkipClient(true)}
                  disabled={isLoading}
                >
                  Skip this step
                </Button>
              )}
              {skipClient && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSkipClient(false)}
                  disabled={isLoading}
                >
                  Add client
                </Button>
              )}
            </div>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </OnboardingLayout>
  )
}
