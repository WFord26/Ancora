"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AddressForm } from "@/components/address-form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Common IANA timezones grouped by region
const TIMEZONES = [
  // Americas
  { label: "America/Anchorage", group: "Americas" },
  { label: "America/Chicago", group: "Americas" },
  { label: "America/Denver", group: "Americas" },
  { label: "America/Los_Angeles", group: "Americas" },
  { label: "America/Mexico_City", group: "Americas" },
  { label: "America/New_York", group: "Americas" },
  { label: "America/Toronto", group: "Americas" },
  { label: "America/Vancouver", group: "Americas" },
  { label: "America/Argentina/Buenos_Aires", group: "Americas" },
  { label: "America/Sao_Paulo", group: "Americas" },
  // Europe
  { label: "Europe/Amsterdam", group: "Europe" },
  { label: "Europe/Berlin", group: "Europe" },
  { label: "Europe/Brussels", group: "Europe" },
  { label: "Europe/Dublin", group: "Europe" },
  { label: "Europe/London", group: "Europe" },
  { label: "Europe/Madrid", group: "Europe" },
  { label: "Europe/Paris", group: "Europe" },
  { label: "Europe/Rome", group: "Europe" },
  { label: "Europe/Vienna", group: "Europe" },
  { label: "Europe/Zurich", group: "Europe" },
  // Asia
  { label: "Asia/Bangkok", group: "Asia" },
  { label: "Asia/Dubai", group: "Asia" },
  { label: "Asia/Hong_Kong", group: "Asia" },
  { label: "Asia/Kolkata", group: "Asia" },
  { label: "Asia/Shanghai", group: "Asia" },
  { label: "Asia/Singapore", group: "Asia" },
  { label: "Asia/Tokyo", group: "Asia" },
  // Pacific
  { label: "Australia/Sydney", group: "Pacific" },
  { label: "Australia/Melbourne", group: "Pacific" },
  { label: "Pacific/Auckland", group: "Pacific" },
  // Africa
  { label: "Africa/Cairo", group: "Africa" },
  { label: "Africa/Johannesburg", group: "Africa" },
  { label: "Africa/Lagos", group: "Africa" },
  { label: "UTC", group: "Other" },
]

export default function NewClientPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [timezone, setTimezone] = useState("")

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

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
      timezone,
    }

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create client")
      }

      router.push("/dashboard/clients")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">New Client</h2>
        <p className="text-muted-foreground">
          Create a new client account
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
          <CardDescription>
            Enter the details for the new client
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  required
                  placeholder="Acme Corporation"
                />
              </div>

              <div>
                <Label htmlFor="primaryContactName">Primary Contact Name</Label>
                <Input
                  id="primaryContactName"
                  name="primaryContactName"
                  placeholder="John Doe"
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
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <AddressForm />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="billingEmail">Billing Email</Label>
                  <Input
                    id="billingEmail"
                    name="billingEmail"
                    type="email"
                    placeholder="billing@acme.com"
                  />
                </div>

                <div>
                  <Label htmlFor="timezone">Timezone *</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select a timezone" />
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
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Client"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
