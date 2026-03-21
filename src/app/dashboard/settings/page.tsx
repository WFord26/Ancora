"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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

interface SettingsData {
  tenantId: string
  tenantName: string
  timezone: string
  settings: {
    companyName?: string
    address?: string
    email?: string
    phone?: string
    website?: string
    taxId?: string
    logoUrl?: string
    updatedAt?: string
  }
}

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [timezone, setTimezone] = useState("")

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setIsLoading(true)
      setError("")
      const response = await fetch("/api/settings")

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You don't have permission to access settings")
        }
        throw new Error("Failed to load settings")
      }

      const data = await response.json()
      if (data.success) {
        setSettings(data.data)
        setTimezone(data.data.timezone)
      } else {
        throw new Error(data.error || "Failed to load settings")
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    if (settings) {
      setSettings({
        ...settings,
        settings: {
          ...settings.settings,
          [field]: value,
        },
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return

    try {
      setIsSaving(true)
      setError("")
      setSuccess("")

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings.settings,
          timezone,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save settings")
      }

      const data = await response.json()
      if (data.success) {
        setSettings(data.data)
        setTimezone(data.data.timezone)
        setSuccess("Settings saved successfully!")
        setTimeout(() => setSuccess(""), 3000)
      } else {
        throw new Error(data.error || "Failed to save settings")
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your company information and account preferences
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Information Section */}
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>
              Details about your company that appear on invoices and communications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={settings?.settings.companyName || ""}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
                placeholder="Your Company Name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings?.settings.email || ""}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="contact@company.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={settings?.settings.phone || ""}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={settings?.settings.website || ""}
                onChange={(e) => handleInputChange("website", e.target.value)}
                placeholder="https://www.example.com"
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={settings?.settings.address || ""}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="123 Main St."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="taxId">Tax ID / VAT Number</Label>
              <Input
                id="taxId"
                value={settings?.settings.taxId || ""}
                onChange={(e) => handleInputChange("taxId", e.target.value)}
                placeholder="XX-XXXXXXX"
              />
            </div>
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card>
          <CardHeader>
            <CardTitle>Billing Preferences</CardTitle>
            <CardDescription>
              Default settings for invoices and billing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="timezone">Timezone *</Label>
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
              <p className="text-xs text-muted-foreground mt-1">
                IANA timezone used for billing cycles and time calculations
              </p>
            </div>

            <div>
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="url"
                value={settings?.settings.logoUrl || ""}
                onChange={(e) => handleInputChange("logoUrl", e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL to your company logo for invoices
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Account Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Read-only account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Account ID</Label>
              <p className="text-sm font-mono text-muted-foreground mt-1">
                {settings?.tenantId}
              </p>
            </div>
            <div>
              <Label>Account Name</Label>
              <p className="text-sm font-mono text-muted-foreground mt-1">
                {settings?.tenantName}
              </p>
            </div>
            {settings?.settings.updatedAt && (
              <div>
                <Label>Last Updated</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(settings.settings.updatedAt).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex gap-4">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchSettings()}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
