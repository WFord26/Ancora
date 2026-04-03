"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import AppSurface from "@/components/layout/app-surface"

export default function AcceptClientInvitePage() {
  const [token, setToken] = useState("")
  const [status, setStatus] = useState<"loading" | "error" | "valid" | "completed">("loading")
  const [invitation, setInvitation] = useState<any>(null)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const invitationToken = new URLSearchParams(window.location.search).get("token")

    if (!invitationToken) {
      setError("Invalid invitation link")
      setStatus("error")
      return
    }

    setToken(invitationToken)
    verifyInvitation(invitationToken)
  }, [])

  async function verifyInvitation(invitationToken: string) {
    try {
      const res = await fetch(`/api/auth/client-invitations/${invitationToken}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Invalid or expired invitation")
        setStatus("error")
        return
      }

      setInvitation(data.invitation)
      setStatus("valid")
    } catch (err: any) {
      setError(err.message || "Failed to verify invitation")
      setStatus("error")
    }
  }

  async function handleAcceptInvitation() {
    if (!invitation) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/auth/client-invitations/${token}/accept`, {
        method: "POST",
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to accept invitation")
        setIsSubmitting(false)
        return
      }

      setStatus("completed")
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation")
      setIsSubmitting(false)
    }
  }

  if (status === "loading") {
    return (
      <AppSurface>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AppSurface>
    )
  }

  if (status === "error") {
    return (
      <AppSurface>
        <div className="flex min-h-screen items-center justify-center px-4 py-12">
          <Card className="w-full max-w-sm border-destructive/20 bg-slate-900/60 shadow-2xl shadow-slate-950/30 backdrop-blur">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-white">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-slate-400">{error}</p>
            <Button className="w-full" variant="outline" asChild>
              <Link href="/">Return Home</Link>
            </Button>
          </CardContent>
          </Card>
        </div>
      </AppSurface>
    )
  }

  if (status === "completed") {
    return (
      <AppSurface>
        <div className="flex min-h-screen items-center justify-center px-4 py-12">
          <Card className="w-full max-w-sm border-emerald-500/30 bg-slate-900/60 shadow-2xl shadow-slate-950/30 backdrop-blur">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <CardTitle className="text-center text-white">Invitation Accepted!</CardTitle>
            <CardDescription className="text-center text-slate-400">
              You now have access to your retainer portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-400">
              Welcome to the Ancora client portal! You can now view your retainers, invoices, and billing information.
            </p>
            <Button className="w-full" asChild>
              <Link href="/portal">Access Portal</Link>
            </Button>
          </CardContent>
          </Card>
        </div>
      </AppSurface>
    )
  }

  return (
    <AppSurface>
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <Card className="border-slate-800/80 bg-slate-900/60 shadow-2xl shadow-slate-950/30 backdrop-blur">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-white">Accept Invitation</CardTitle>
            <CardDescription className="text-slate-400">
              You've been invited to view your retainer information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {invitation && (
              <>
                <div className="space-y-2 rounded-lg bg-slate-950/60 p-4">
                  <p className="text-sm">
                    <span className="text-slate-400">Tenant:</span>{" "}
                    <span className="font-medium">{invitation.tenant?.name}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-400">Client:</span>{" "}
                    <span className="font-medium">{invitation.client?.companyName}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-400">Email:</span>{" "}
                    <span className="font-medium">{invitation.email}</span>
                  </p>
                </div>

                <p className="text-sm text-slate-400">
                  By accepting this invitation, you'll gain access to your retainer portal where you can view invoices, track included hours, and monitor billing.
                </p>

                <Button 
                  className="w-full" 
                  onClick={handleAcceptInvitation}
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Accept Invitation
                </Button>
              </>
            )}
          </CardContent>
          </Card>
        </div>
      </div>
    </AppSurface>
  )
}
