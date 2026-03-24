"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

export default function AcceptClientInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  
  const [status, setStatus] = useState<"loading" | "error" | "valid" | "completed">("loading")
  const [invitation, setInvitation] = useState<any>(null)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link")
      setStatus("error")
      return
    }

    verifyInvitation()
  }, [token])

  async function verifyInvitation() {
    try {
      const res = await fetch(`/api/auth/client-invitations/${token}`)
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
        <Card className="w-full max-w-sm border-destructive/20">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            <Button className="w-full" variant="outline" asChild>
              <Link href="/">Return Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
        <Card className="w-full max-w-sm border-green-200 dark:border-green-900">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <CardTitle className="text-center">Invitation Accepted!</CardTitle>
            <CardDescription className="text-center">
              You now have access to your retainer portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Welcome to the Ancora client portal! You can now view your retainers, invoices, and billing information.
            </p>
            <Button className="w-full" asChild>
              <Link href="/portal">Access Portal</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Accept Invitation</CardTitle>
            <CardDescription>
              You've been invited to view your retainer information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {invitation && (
              <>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Tenant:</span>{" "}
                    <span className="font-medium">{invitation.tenant?.name}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Client:</span>{" "}
                    <span className="font-medium">{invitation.client?.companyName}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <span className="font-medium">{invitation.email}</span>
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">
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
  )
}
