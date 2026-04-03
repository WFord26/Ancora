"use client"

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2 } from "lucide-react"
import AppSurface from "@/components/layout/app-surface"

export default function SignInPage() {
  const router = useRouter()
  const [callbackUrl, setCallbackUrl] = useState("/dashboard")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const nextCallbackUrl =
      new URLSearchParams(window.location.search).get("callbackUrl") || "/dashboard"

    setCallbackUrl(nextCallbackUrl)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError(result.error)
        setIsLoading(false)
      } else if (result?.ok) {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setError("An error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <AppSurface>
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center mb-6">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600" />
        </div>

        <Card className="border-slate-800/80 bg-slate-900/60 shadow-2xl shadow-slate-950/30 backdrop-blur">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-white">Sign In</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your credentials to access the app
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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p className="text-slate-400">
                Need to bootstrap this instance?{" "}
                <Link
                  href="/auth/landing/setup"
                  className="font-medium text-sky-300 hover:underline"
                >
                  Run the installer
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </AppSurface>
  )
}
