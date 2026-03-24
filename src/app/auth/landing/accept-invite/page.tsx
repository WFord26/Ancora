"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  
  const [status, setStatus] = useState<"loading" | "error" | "valid">("loading")
  const [invitation, setInvitation] = useState<any>(null)
  const [error, setError] = useState("")

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
      const res = await fetch(`/api/auth/invitations/${token}`)
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
            <CardTitle className="text-center">Invalid Invitation</CardTitle>
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Accept Invitation</CardTitle>
            <CardDescription>
              You've been invited to join {invitation?.tenant?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm">
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="font-medium">{invitation?.email}</span>
              </p>
              <p className="text-sm mt-2">
                <span className="text-muted-foreground">Role:</span>{" "}
                <span className="font-medium">{invitation?.role}</span>
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              Click the button below to create your account and accept this invitation.
            </p>

            <Button className="w-full" asChild>
              <Link href={`/auth/landing/accept-invite?token=${token}&create=true`}>
                Create Account & Accept
              </Link>
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/auth/signin" className="font-medium text-foreground hover:underline">
                Sign in here
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
