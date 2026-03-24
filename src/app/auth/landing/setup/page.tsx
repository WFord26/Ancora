"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react"

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<"input" | "success">("input")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Validate
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
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to create account")
        setIsLoading(false)
        return
      }

      setStep("success")
    } catch (err: any) {
      setError(err.message || "An error occurred")
      setIsLoading(false)
    }
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
        <div className="w-full max-w-sm space-y-6">
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="space-y-2">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-center">Account Created!</CardTitle>
              <CardDescription className="text-center">
                Your account and tenant have been set up successfully
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  A confirmation email has been sent to <strong>{formData.email}</strong>
                </p>
                <p className="text-muted-foreground">
                  Let's set up your workspace so you can start tracking time immediately.
                </p>
              </div>
              <Button 
                className="w-full" 
                asChild
              >
                <Link href="/auth/signin">Continue to Setup</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center mb-6">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600" />
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Start Your Free Trial</CardTitle>
            <CardDescription>
              Create your account and get started with Ancora
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
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Your Company"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Your Name</Label>
                <Input
                  id="contact"
                  type="text"
                  placeholder="John Doe"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  disabled={isLoading}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>Already have an account?{" "}
                <Link
                  href="/auth/signin"
                  className="font-medium text-foreground hover:underline"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
