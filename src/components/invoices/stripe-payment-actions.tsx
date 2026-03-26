"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface StripePaymentActionsProps {
  invoiceId: string
  portalInvoiceUrl: string
  stripeReady: boolean
  disabled?: boolean
}

export function StripePaymentActions({
  invoiceId,
  portalInvoiceUrl,
  stripeReady,
  disabled = false,
}: StripePaymentActionsProps) {
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleOpenCheckout() {
    setIsOpeningCheckout(true)
    setError("")
    setMessage("")

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "checkout" }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to create Stripe Checkout session")
      }

      if (!data.data?.checkoutUrl) {
        throw new Error("Stripe Checkout URL was not returned")
      }

      window.open(data.data.checkoutUrl, "_blank", "noopener,noreferrer")
    } catch (err: any) {
      setError(err.message || "Failed to open Stripe Checkout")
    } finally {
      setIsOpeningCheckout(false)
    }
  }

  async function handleCopyPortalLink() {
    setIsCopying(true)
    setError("")
    setMessage("")

    try {
      await navigator.clipboard.writeText(portalInvoiceUrl)
      setMessage("Client invoice link copied to clipboard")
    } catch (err: any) {
      setError(err.message || "Failed to copy invoice link")
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleCopyPortalLink}
          disabled={disabled || isCopying}
        >
          {isCopying ? "Copying..." : "Copy Client Link"}
        </Button>
        <Button
          type="button"
          onClick={handleOpenCheckout}
          disabled={disabled || !stripeReady || isOpeningCheckout}
        >
          {isOpeningCheckout ? "Opening Checkout..." : "Open Stripe Checkout"}
        </Button>
      </div>

      {!stripeReady && (
        <p className="text-xs text-muted-foreground">
          Stripe checkout is unavailable until `STRIPE_SECRET_KEY` and
          `STRIPE_WEBHOOK_SECRET` are configured.
        </p>
      )}

      {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
