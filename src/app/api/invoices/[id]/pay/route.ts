import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { markInvoicePaid } from "@/lib/invoice"
import prisma from "@/db"

/**
 * POST /api/invoices/[id]/pay
 * 
 * Mark invoice as PAID
 * 
 * Admin/Staff only (manual payment recording)
 * Also called by Stripe webhooks (will need webhook auth bypass)
 * 
 * Body:
 * - paidDate?: string (ISO date, defaults to now)
 * - paymentMethod?: string (e.g., "stripe", "check", "wire")
 * - paymentReference?: string (e.g., Stripe payment intent ID, check number)
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

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const invoiceId = params.id
    const body = await request.json()
    const { paidDate, paymentMethod, paymentReference } = body

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, tenantId: session.user.tenantId },
      select: { id: true, total: true, status: true },
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (existingInvoice.status === "PAID") {
      return NextResponse.json(
        { error: "Invoice is already marked as paid" },
        { status: 400 }
      )
    }

    if (existingInvoice.status === "VOID") {
      return NextResponse.json(
        { error: "Voided invoices cannot be marked as paid" },
        { status: 400 }
      )
    }

    // Mark invoice as paid
    await markInvoicePaid(
      invoiceId,
      session.user.tenantId,
      paidDate ? new Date(paidDate) : undefined
    )

    // Record payment if metadata provided
    if (paymentMethod || paymentReference) {
      await prisma.payment.create({
        data: {
          invoiceId,
          amount: existingInvoice.total,
          paymentMethod: paymentMethod?.trim() || null,
          stripePaymentIntentId: paymentReference?.trim() || null,
          status: "SUCCEEDED",
          paidAt: paidDate ? new Date(paidDate) : new Date(),
        },
      })
    }

    // Fetch the updated invoice
    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
        retainerPeriod: true,
        lineItems: true,
        payments: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Invoice marked as paid",
      data: updatedInvoice,
    })
  } catch (error: any) {
    console.error("Error marking invoice paid:", error)

    const status = error.message?.includes("not found")
      ? 404
      : error.message?.includes("already marked as paid") ||
        error.message?.includes("cannot be marked as paid")
        ? 400
        : 500

    return NextResponse.json(
      { error: error.message || "Failed to mark invoice as paid" },
      { status }
    )
  }
}
