"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { useEffect, useRef, useState } from "react"
import { Loader2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type LogoutPageProps = {
  callbackUrl: string
}

export default function LogoutPage({ callbackUrl }: LogoutPageProps) {
  const startedRef = useRef(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (startedRef.current) {
      return
    }

    startedRef.current = true

    void signOut({
      callbackUrl,
      redirect: true,
    }).catch((logoutError) => {
      console.error("Sign out failed:", logoutError)
      setError("We couldn't sign you out automatically. Try again below.")
      startedRef.current = false
    })
  }, [callbackUrl])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {error ? <LogOut className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
          </div>
          <CardTitle className="text-2xl">Signing you out</CardTitle>
          <CardDescription>
            {error
              ? "Your session is still active until sign-out completes."
              : "We’re closing your session and sending you back to the landing page."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => {
              setError("")
              startedRef.current = false
              void signOut({
                callbackUrl,
                redirect: true,
              }).catch((logoutError) => {
                console.error("Sign out retry failed:", logoutError)
                setError("Sign-out is still failing. You can return home and try again.")
              })
            }}
          >
            {error ? "Try Sign Out Again" : "Processing..."}
          </Button>

          <Button variant="outline" className="w-full" asChild>
            <Link href={callbackUrl}>Return Without Signing Out</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
