import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/db"
import { InvoiceStatus } from "@prisma/client"

/**
 * GET /api/invoices
 * 
 * List invoices with optional filters
 * 
 * Query params:
 * - clientId: Filter by client ID
 * - status: Filter by status (DRAFT, SENT, PAID, OVERDUE, VOID)
 * - startDate: Filter by issueDate >= startDate (ISO date string)
 * - endDate: Filter by issueDate <= endDate (ISO date string)
 * - page: Page number (default 1)
 * - limit: Items per page (default 25)
 * 
 * Admin/Staff: See all invoices for tenant
 * Client: See only their own invoices
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId")
    const status = searchParams.get("status") as InvoiceStatus | null
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "25")
    const skip = (page - 1) * limit

    // Build query filters
    const where: any = { tenantId: session.user.tenantId }

    // Client role can only see their own invoices
    if (session.user.role === "CLIENT") {
      // Assuming user.clientId exists (may need schema update if not)
      // For now, filter by client's email match
      const clientMatch = await prisma.client.findFirst({
        where: {
          tenantId: session.user.tenantId,
          email: session.user.email,
        },
      })
      if (!clientMatch) {
        return NextResponse.json({ data: [], total: 0, page, limit })
      }
      where.clientId = clientMatch.id
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (status) {
      where.status = status
    }

    if (startDate || endDate) {
      where.issuedDate = {}
      if (startDate) {
        where.issuedDate.gte = new Date(startDate)
      }
      if (endDate) {
        where.issuedDate.lte = new Date(endDate)
      }
    }

    // Execute query
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          issuedDate: "desc",
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          retainerPeriod: {
            select: {
              id: true,
              retainer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          lineItems: {
            select: {
              id: true,
              lineType: true,
              description: true,
              quantity: true,
              unitPrice: true,
              total: true,
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ])

    return NextResponse.json({
      data: invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: any) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch invoices" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/invoices
 * 
 * Create a manual invoice (for ad-hoc invoicing outside of billing cycle)
 * 
 * Admin/Staff only
 * 
 * Body:
 * - clientId: string (required)
 * - dueDate: string (ISO date)
 * - lineItems: Array<{ lineType, description, quantity, unitPrice }>
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { clientId, dueDate, lineItems } = body

    if (!clientId || !dueDate || !lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: "clientId, dueDate, and lineItems are required" },
        { status: 400 }
      )
    }

    // Verify client belongs to tenant
    const client = await prisma.client.findUnique({
      where: { id: clientId, tenantId: session.user.tenantId },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Calculate totals
    const subtotal = lineItems.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unitPrice,
      0
    )
    const tax = 0 // Tax calculation to be implemented
    const total = subtotal + tax

    // Get next invoice number
    const lastInvoice = await prisma.invoice.findFirst({
      where: { tenantId: session.user.tenantId },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    })

    const currentYear = new Date().getFullYear()
    let sequence = 1

    if (lastInvoice?.invoiceNumber) {
      const match = lastInvoice.invoiceNumber.match(/INV-(\d{4})-(\d+)/)
      if (match) {
        const lastYear = parseInt(match[1])
        const lastSequence = parseInt(match[2])
        if (lastYear === currentYear) {
          sequence = lastSequence + 1
        }
      }
    }

    const invoiceNumber = `INV-${currentYear}-${sequence.toString().padStart(5, "0")}`

    // Create invoice with line items
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        tenantId: session.user.tenantId,
        clientId,
        issuedDate: new Date(),
        dueDate: new Date(dueDate),
        status: "DRAFT",
        subtotal,
        tax,
        total,
        lineItems: {
          create: lineItems.map((item: any) => ({
            lineType: item.lineType || "ADJUSTMENT",
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
      include: {
        client: true,
        retainerPeriod: true,
        lineItems: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: invoice,
    })
  } catch (error: any) {
    console.error("Error creating invoice:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create invoice" },
      { status: 500 }
    )
  }
}
