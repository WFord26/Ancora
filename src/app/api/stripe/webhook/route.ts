import { NextRequest, NextResponse } from "next/server"
import {
  constructWebhookEvent,
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleCheckoutCompleted,
} from "@/lib/stripe"
import type Stripe from "stripe"

/**
 * POST /api/stripe/webhook
 * 
 * Stripe webhook handler.
 * Receives events from Stripe and processes them.
 * 
 * IMPORTANT: This route does NOT use session auth.
 * Authentication is via Stripe webhook signature verification.
 * 
 * Events handled:
 * - payment_intent.succeeded → Mark invoice PAID, update payment record
 * - payment_intent.payment_failed → Update payment record to FAILED
 * - checkout.session.completed → Process checkout completion
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = constructWebhookEvent(body, signature)
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message)
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      )
    }

    // Route event to appropriate handler
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentSucceeded(paymentIntent)
        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailed(paymentIntent)
        break
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      default:
        // Log unhandled events but don't error
        console.log(`Unhandled Stripe event type: ${event.type}`)
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("Stripe webhook error:", error)
    // Return 200 even on errors to prevent Stripe from retrying
    // (log the error for investigation)
    return NextResponse.json(
      { received: true, error: error.message },
      { status: 200 }
    )
  }
}

/**
 * Disable body parsing for webhook route.
 * Stripe signature verification requires the raw body.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
