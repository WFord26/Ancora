"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AddressForm } from "@/components/address-form"

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

export default function EditClientPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [client, setClient] = useState<any>(null)
  const [timezone, setTimezone] = useState("")

  useEffect(() => {
    fetch(`/api/clients/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        console.log('[Client Edit] API response:', data)
        if (data.success && data.data) {
          setClient(data.data)
          setTimezone(data.data.timezone || "")
        } else {
          console.error('[Client Edit] API error:', data.error)
          setError(data.error || "Failed to load client")
        }
        setIsLoading(false)
      })
      .catch((err) => {
        console.error('[Client Edit] Fetch error:', err)
        setError(err.message)
        setIsLoading(false)
      })
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsSaving(true)

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
      timezone: timezone,
      isActive: formData.get("isActive") === "true",
    }

    try {
      const response = await fetch(`/api/clients/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update client")
      }

      router.push(`/dashboard/clients/${params.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center p-12">Loading...</div>
  }

  if (!client) {
    return <div className="flex items-center justify-center p-12">Client not found</div>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Edit Client</h2>
          <p className="text-muted-foreground">
            Update client information
          </p>
        </div>
        <Link href={`/dashboard/clients/${params.id}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                name="companyName"
                required
                defaultValue={client.companyName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="primaryContactName">Primary Contact Name</Label>
              <Input
                id="primaryContactName"
                name="primaryContactName"
                defaultValue={client.primaryContactName || ""}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={client.email || ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={client.phone || ""}
                />
              </div>
            </div>

            <AddressForm data={{
              addressLine1: client.addressLine1,
              addressLine2: client.addressLine2,
              city: client.city,
              state: client.state,
              zipCode: client.zipCode,
            }} />

            <div className="space-y-2">
              <Label htmlFor="billingEmail">Billing Email</Label>
              <Input
                id="billingEmail"
                name="billingEmail"
                type="email"
                defaultValue={client.billingEmail || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a timezone</option>
                {TIMEZONES.map((tz) => (
                  <option key={tz.label} value={tz.label}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="isActive">Status</Label>
              <select
                id="isActive"
                name="isActive"
                defaultValue={client.isActive ? "true" : "false"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              <Link href={`/dashboard/clients/${params.id}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
