import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/db"

/**
 * GET /api/invoices/[id]
 * 
 * Get invoice details with line items
 * 
 * Admin/Staff: Can view any invoice
 * Client: Can only view their own invoices
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const invoiceId = params.id

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, tenantId: session.user.tenantId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            country: true,
          },
        },
        retainerPeriod: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            includedHours: true,
            usedHours: true,
            overageHours: true,
            retainer: {
              select: {
                id: true,
                name: true,
                includedHours: true,
                ratePerHour: true,
              },
            },
          },
        },
        lineItems: {
          orderBy: { id: "asc" },
          include: {
            expense: {
              select: {
                id: true,
                description: true,
                expenseDate: true,
                amount: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Client role can only view their own invoices
    if (session.user.role === "CLIENT") {
      const clientMatch = await prisma.client.findFirst({
        where: {
          tenantId: session.user.tenantId,
          email: session.user.email,
        },
      })
      
      if (!clientMatch || invoice.clientId !== clientMatch.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.json({ data: invoice })
  } catch (error: any) {
    console.error("Error fetching invoice:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch invoice" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/invoices/[id]
 * 
 * Update invoice (DRAFT status only)
 * 
 * Admin/Staff only
 * 
 * Body:
 * - dueDate?: string
 * - notes?: string
 * - lineItems?: Array (replaces all line items)
 */
export async function PATCH(
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
    const { dueDate, lineItems } = body

    // Verify invoice exists and is DRAFT
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, tenantId: session.user.tenantId },
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (existingInvoice.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT invoices can be edited" },
        { status: 400 }
      )
    }

    // If lineItems provided, recalculate totals
    let updateData: any = {}

    if (dueDate) {
      updateData.dueDate = new Date(dueDate)
    }

    if (lineItems) {
      // Delete existing line items and create new ones
      await prisma.invoiceLineItem.deleteMany({
        where: { invoiceId },
      })

      const subtotal = lineItems.reduce(
        (sum: number, item: any) => sum + item.quantity * item.unitPrice,
        0
      )
      const tax = 0
      const total = subtotal + tax

      updateData.subtotal = subtotal
      updateData.tax = tax
      updateData.total = total
    }

    // Update invoice
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        client: true,
        retainerPeriod: true,
        lineItems: true,
      },
    })

    // Create new line items if provided
    if (lineItems) {
      await prisma.invoiceLineItem.createMany({
        data: lineItems.map((item: any) => ({
          invoiceId,
          lineType: item.lineType || "ADJUSTMENT",
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        })),
      })

      // Fetch updated invoice with new line items
      const updatedInvoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: true,
          retainerPeriod: true,
          lineItems: true,
        },
      })

      return NextResponse.json({
        success: true,
        data: updatedInvoice,
      })
    }

    return NextResponse.json({
      success: true,
      data: invoice,
    })
  } catch (error: any) {
    console.error("Error updating invoice:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update invoice" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/invoices/[id]
 * 
 * Soft delete invoice (mark as VOID)
 * 
 * Admin only
 * Cannot void PAID invoices
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const invoiceId = params.id

    // Verify invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, tenantId: session.user.tenantId },
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (existingInvoice.status === "PAID") {
      return NextResponse.json(
        { error: "Cannot void paid invoices" },
        { status: 400 }
      )
    }

    // Mark as VOID
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "VOID" },
    })

    return NextResponse.json({
      success: true,
      data: invoice,
    })
  } catch (error: any) {
    console.error("Error voiding invoice:", error)
    return NextResponse.json(
      { error: error.message || "Failed to void invoice" },
      { status: 500 }
    )
  }
}
