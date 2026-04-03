"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AppSurface from "@/components/layout/app-surface"

export default function PortalLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<"password" | "magic">("password")

  // Pick up error from magic link verification redirect
  useEffect(() => {
    const errorParam = new URLSearchParams(window.location.search).get("error")
    if (errorParam) {
      setError(errorParam)
    }
  }, [])

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or password")
      } else {
        router.push("/portal")
        router.refresh()
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to send login link")
      }

      setSuccess("Check your email for a login link. It expires in 15 minutes.")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AppSurface>
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8 rounded-[28px] border border-slate-800/80 bg-slate-900/60 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Ancora</h1>
          <p className="mt-1 text-lg text-slate-300">Client Portal</p>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to view your retainers, invoices, and make payments
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex rounded-lg border border-slate-800 bg-slate-950/70 p-1">
          <button
            type="button"
            onClick={() => { setMode("password"); setError(""); setSuccess("") }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "password"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => { setMode("magic"); setError(""); setSuccess("") }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "magic"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Magic Link
          </button>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        {mode === "password" ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-200">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-200">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label htmlFor="magic-email" className="block text-sm font-medium text-slate-200">
                Email
              </label>
              <input
                id="magic-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                placeholder="you@company.com"
              />
              <p className="mt-2 text-xs text-slate-400">
                We&apos;ll send a one-time login link to your email address.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? "Sending..." : "Send Login Link"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-400">
          Staff?{" "}
          <Link href="/auth/signin" className="text-sky-300 hover:underline">
            Sign in here
          </Link>
        </p>
        </div>
      </div>
    </AppSurface>
  )
}
