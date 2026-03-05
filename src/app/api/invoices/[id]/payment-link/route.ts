import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createCheckoutSession, createPaymentIntent } from "@/lib/stripe"

/**
 * POST /api/invoices/[id]/payment-link
 * 
 * Generate a Stripe payment link (Checkout Session) for an invoice.
 * 
 * Admin/Staff: Generate payment link to send to client
 * Client: Generate their own payment link for self-service payment
 * 
 * Body:
 * - mode?: "checkout" (default) | "intent"
 *     - "checkout": Creates a Stripe Checkout Session (hosted page)
 *     - "intent": Creates a Payment Intent (for embedded payment form)
 * - successUrl?: string (required for checkout mode, URL after payment)
 * - cancelUrl?: string (URL if client cancels checkout)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const invoiceId = params.id
    const body = await request.json()
    const {
      mode = "checkout",
      successUrl,
      cancelUrl,
    } = body

    // Determine base URL for default success/cancel URLs
    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000"

    if (mode === "intent") {
      // Create Payment Intent (for embedded payment form)
      const result = await createPaymentIntent(
        invoiceId,
        session.user.tenantId
      )

      return NextResponse.json({
        success: true,
        mode: "intent",
        data: {
          clientSecret: result.clientSecret,
          paymentIntentId: result.paymentIntentId,
        },
      })
    }

    // Default: Create Checkout Session
    const result = await createCheckoutSession({
      invoiceId,
      tenantId: session.user.tenantId,
      successUrl: successUrl || `${origin}/portal/invoices/${invoiceId}?payment=success`,
      cancelUrl: cancelUrl || `${origin}/portal/invoices/${invoiceId}?payment=cancelled`,
    })

    return NextResponse.json({
      success: true,
      mode: "checkout",
      data: {
        checkoutUrl: result.checkoutUrl,
        sessionId: result.sessionId,
      },
    })
  } catch (error: any) {
    console.error("Error creating payment link:", error)

    const status = error.message?.includes("not found")
      ? 404
      : error.message?.includes("already paid") || error.message?.includes("voided")
        ? 400
        : 500

    return NextResponse.json(
      { error: error.message || "Failed to create payment link" },
      { status }
    )
  }
}
