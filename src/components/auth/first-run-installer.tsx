"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { COMMON_TIMEZONES, DEFAULT_TIMEZONE } from "@/lib/timezone-options"
import { AlertCircle, CheckCircle2, Loader2, ServerCog } from "lucide-react"

export default function FirstRunInstaller() {
  const [step, setStep] = useState<"input" | "success">("input")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [emailDelivered, setEmailDelivered] = useState(true)
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    password: "",
    confirmPassword: "",
    timezone: DEFAULT_TIMEZONE,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters")
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: formData.companyName,
          contactName: formData.contactName,
          email: formData.email,
          password: formData.password,
          timezone: formData.timezone,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to create account")
        setIsLoading(false)
        return
      }

      setEmailDelivered(data.emailDelivered !== false)
      setStep("success")
    } catch (err: any) {
      setError(err.message || "An error occurred")
      setIsLoading(false)
    }
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
        <div className="w-full max-w-lg space-y-6">
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="space-y-2">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-center">Ancora Is Installed</CardTitle>
              <CardDescription className="text-center">
                Your first workspace and admin account are ready
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Sign in with <strong>{formData.email}</strong> to continue onboarding.
                </p>
                <p>
                  After you log in, Ancora will walk you through creating your first
                  client, retainer, and team setup.
                </p>
                {!emailDelivered && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-200">
                    Welcome email delivery is not configured yet, but the account was
                    created successfully.
                  </div>
                )}
              </div>
              <Button className="w-full" asChild>
                <Link href="/auth/signin">Continue to Sign In</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-5xl grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <ServerCog className="h-3.5 w-3.5" />
              Production First-Time Installer
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight">
                Install Ancora on this production instance
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground">
                This one-time bootstrap creates your first workspace, primary admin,
                and billing timezone. After installation, the public installer locks
                and the rest of setup continues inside the app.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">1. Create Workspace</CardTitle>
                <CardDescription>
                  Name the business that will own this self-hosted deployment.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">2. Create Admin</CardTitle>
                <CardDescription>
                  Set the first admin login used to manage clients, billing, and staff.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">3. Finish In-App</CardTitle>
                <CardDescription>
                  Sign in and continue the guided onboarding for clients and retainers.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Bootstrap Workspace</CardTitle>
            <CardDescription>
              This installer is available only on a fresh production database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex gap-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="company">Workspace Name</Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Ancora Consulting"
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Primary Admin Name</Label>
                <Input
                  id="contact"
                  type="text"
                  placeholder="Jordan Lee"
                  value={formData.contactName}
                  onChange={(e) =>
                    setFormData({ ...formData, contactName: e.target.value })
                  }
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Admin Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Workspace Timezone</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(timezone) =>
                    setFormData({ ...formData, timezone })
                  }
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map((timezone) => (
                      <SelectItem key={timezone.value} value={timezone.value}>
                        {timezone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for billing periods, reporting, and invoice timestamps.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  disabled={isLoading}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Install Ancora
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
