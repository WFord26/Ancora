import Stripe from "stripe"
import { prisma } from "@/db"
import { decimalToNumber } from "@/lib/billing"
import { sendPaymentReceivedNotification, sendAdminPaymentNotification } from "@/lib/email"

// ============================================
// Stripe Client Singleton
// ============================================

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set")
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2023-10-16",
      typescript: true,
    })
  }
  return stripeInstance
}

// ============================================
// Customer Management
// ============================================

/**
 * Get or create a Stripe customer for a client.
 * Stores the Stripe customer ID on the Client record.
 */
export async function getOrCreateStripeCustomer(
  clientId: string,
  tenantId: string
): Promise<string> {
  const client = await prisma.client.findUnique({
    where: { id: clientId, tenantId },
    select: {
      id: true,
      companyName: true,
      email: true,
      billingEmail: true,
      phone: true,
      address: true,
      stripeCustomerId: true,
    },
  })

  if (!client) {
    throw new Error("Client not found")
  }

  // Return existing customer ID if we have one
  if (client.stripeCustomerId) {
    // Verify customer still exists in Stripe
    try {
      const stripe = getStripe()
      await stripe.customers.retrieve(client.stripeCustomerId)
      return client.stripeCustomerId
    } catch {
      // Customer was deleted in Stripe, create a new one
    }
  }

  const stripe = getStripe()
  const customer = await stripe.customers.create({
    name: client.companyName,
    email: client.billingEmail || client.email || undefined,
    phone: client.phone || undefined,
    metadata: {
      clientId: client.id,
      tenantId,
    },
  })

  // Store the Stripe customer ID
  await prisma.client.update({
    where: { id: clientId },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}

/**
 * Update Stripe customer details when client info changes.
 */
export async function syncStripeCustomer(
  clientId: string,
  tenantId: string
): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId, tenantId },
    select: {
      companyName: true,
      email: true,
      billingEmail: true,
      phone: true,
      stripeCustomerId: true,
    },
  })

  if (!client?.stripeCustomerId) return

  const stripe = getStripe()
  await stripe.customers.update(client.stripeCustomerId, {
    name: client.companyName,
    email: client.billingEmail || client.email || undefined,
    phone: client.phone || undefined,
  })
}

// ============================================
// Checkout Sessions (Payment Links)
// ============================================

export interface CreateCheckoutOptions {
  invoiceId: string
  tenantId: string
  successUrl: string
  cancelUrl: string
}

/**
 * Create a Stripe Checkout Session for an invoice.
 * Returns the checkout URL for the client to pay.
 */
export async function createCheckoutSession(
  options: CreateCheckoutOptions
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const { invoiceId, tenantId, successUrl, cancelUrl } = options

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId, tenantId },
    include: {
      client: true,
      lineItems: true,
    },
  })

  if (!invoice) {
    throw new Error("Invoice not found")
  }

  if (invoice.status === "PAID") {
    throw new Error("Invoice is already paid")
  }

  if (invoice.status === "VOID") {
    throw new Error("Invoice is voided")
  }

  const stripe = getStripe()

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(invoice.clientId, tenantId)

  // Build line items from invoice
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    invoice.lineItems.map((item: any) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.description,
        },
        unit_amount: Math.round(decimalToNumber(item.unitPrice) * 100), // Stripe uses cents
      },
      quantity: Math.round(decimalToNumber(item.quantity) * 100) / 100 || 1,
    }))

  // Add tax as a separate line item if non-zero
  const taxAmount = decimalToNumber(invoice.tax)
  if (taxAmount > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Tax",
        },
        unit_amount: Math.round(taxAmount * 100),
      },
      quantity: 1,
    })
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      tenantId,
    },
    payment_intent_data: {
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        tenantId,
      },
    },
  })

  // Store the Stripe invoice ID reference
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { stripeInvoiceId: session.id },
  })

  if (!session.url) {
    throw new Error("Failed to create checkout session URL")
  }

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  }
}

// ============================================
// Payment Intents (Direct Integration)
// ============================================

/**
 * Create a Payment Intent for an invoice.
 * Used for custom payment flows (embedded form).
 */
export async function createPaymentIntent(
  invoiceId: string,
  tenantId: string
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId, tenantId },
    include: { client: true },
  })

  if (!invoice) {
    throw new Error("Invoice not found")
  }

  if (invoice.status === "PAID") {
    throw new Error("Invoice is already paid")
  }

  const stripe = getStripe()
  const customerId = await getOrCreateStripeCustomer(invoice.clientId, tenantId)

  const totalCents = Math.round(decimalToNumber(invoice.total) * 100)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: "usd",
    customer: customerId,
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      tenantId,
    },
    description: `Payment for invoice ${invoice.invoiceNumber}`,
    automatic_payment_methods: {
      enabled: true,
    },
  })

  // Create a pending payment record
  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: invoice.total,
      paymentMethod: "stripe",
      stripePaymentIntentId: paymentIntent.id,
      status: "PENDING",
    },
  })

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  }
}

// ============================================
// Webhook Event Handlers
// ============================================

/**
 * Verify and construct a Stripe webhook event.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set")
  }
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
}

/**
 * Handle a successful payment from Stripe.
 * Updates Payment record, marks Invoice as PAID.
 */
export async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const invoiceId = paymentIntent.metadata?.invoiceId
  if (!invoiceId) {
    console.warn("Payment intent has no invoiceId in metadata:", paymentIntent.id)
    return
  }

  const tenantId = paymentIntent.metadata?.tenantId

  // Update or create payment record
  const existingPayment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id },
  })

  if (existingPayment) {
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        status: "SUCCEEDED",
        paidAt: new Date(),
      },
    })
  } else {
    await prisma.payment.create({
      data: {
        invoiceId,
        amount: paymentIntent.amount / 100, // Convert from cents
        paymentMethod: "stripe",
        stripePaymentIntentId: paymentIntent.id,
        status: "SUCCEEDED",
        paidAt: new Date(),
      },
    })
  }

  // Mark invoice as paid
  const updateData: any = {
    status: "PAID",
    paidDate: new Date(),
  }

  // Store the Stripe invoice ID if from checkout session
  if (paymentIntent.metadata?.checkoutSessionId) {
    updateData.stripeInvoiceId = paymentIntent.metadata.checkoutSessionId
  }

  const whereClause: any = { id: invoiceId }
  if (tenantId) {
    whereClause.tenantId = tenantId
  }

  await prisma.invoice.update({
    where: whereClause,
    data: updateData,
  })

  console.log(`Invoice ${invoiceId} marked as PAID via Stripe payment ${paymentIntent.id}`)

  // Send payment confirmation emails
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: { select: { companyName: true, email: true, billingEmail: true } },
        tenant: { select: { name: true } },
      },
    })

    if (invoice) {
      const clientEmail = invoice.client.billingEmail || invoice.client.email
      const amount = paymentIntent.amount / 100

      if (clientEmail) {
        await sendPaymentReceivedNotification({
          to: clientEmail,
          clientName: invoice.client.companyName,
          invoiceNumber: invoice.invoiceNumber,
          amount,
          paymentDate: new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        })
      }

      // Notify admin
      await sendAdminPaymentNotification({
        to: process.env.ADMIN_EMAIL || "admin@ancora.app",
        clientName: invoice.client.companyName,
        invoiceNumber: invoice.invoiceNumber,
        amount,
      })
    }
  } catch (emailError) {
    console.error("Failed to send payment notification emails:", emailError)
    // Don't throw — payment was already processed successfully
  }
}

/**
 * Handle a failed payment from Stripe.
 * Updates Payment record status. Invoice remains unpaid.
 */
export async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const invoiceId = paymentIntent.metadata?.invoiceId
  if (!invoiceId) {
    console.warn("Payment intent has no invoiceId in metadata:", paymentIntent.id)
    return
  }

  const existingPayment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id },
  })

  if (existingPayment) {
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: { status: "FAILED" },
    })
  } else {
    await prisma.payment.create({
      data: {
        invoiceId,
        amount: paymentIntent.amount / 100,
        paymentMethod: "stripe",
        stripePaymentIntentId: paymentIntent.id,
        status: "FAILED",
      },
    })
  }

  console.log(`Payment failed for invoice ${invoiceId}: ${paymentIntent.id}`)
}

/**
 * Handle checkout.session.completed event.
 * This fires when a checkout session is completed (even before payment succeeds).
 */
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const invoiceId = session.metadata?.invoiceId
  if (!invoiceId) {
    console.warn("Checkout session has no invoiceId in metadata:", session.id)
    return
  }

  // If payment is already collected, mark as paid
  if (session.payment_status === "paid") {
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id

    if (paymentIntentId) {
      const stripe = getStripe()
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      await handlePaymentSucceeded(paymentIntent)
    }
  }
}

// ============================================
// Stripe Customer Portal
// ============================================

/**
 * Create a Stripe Customer Portal session.
 * Allows clients to manage payment methods and view payment history.
 */
export async function createCustomerPortalSession(
  clientId: string,
  tenantId: string,
  returnUrl: string
): Promise<string> {
  const client = await prisma.client.findUnique({
    where: { id: clientId, tenantId },
    select: { stripeCustomerId: true },
  })

  if (!client?.stripeCustomerId) {
    throw new Error("Client does not have a Stripe customer account")
  }

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: client.stripeCustomerId,
    return_url: returnUrl,
  })

  return session.url
}
