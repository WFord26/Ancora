import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"

/**
 * GET /api/reports/aging
 * 
 * Returns aging invoices breakdown:
 *   - Current (not yet due)
 *   - 1-30 days overdue
 *   - 31-60 days overdue
 *   - 61-90 days overdue
 *   - 90+ days overdue
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: { in: ["SENT", "OVERDUE"] },
      },
      include: {
        client: { select: { id: true, companyName: true, email: true } },
      },
      orderBy: { dueDate: "asc" },
    })

    const now = new Date()
    const dayMs = 24 * 60 * 60 * 1000

    interface AgingInvoice {
      invoiceId: string
      invoiceNumber: string
      clientId: string
      clientName: string
      clientEmail: string | null
      issuedDate: Date
      dueDate: Date
      total: number
      daysOverdue: number
      bucket: string
    }

    const buckets = {
      current: [] as AgingInvoice[],
      "1-30": [] as AgingInvoice[],
      "31-60": [] as AgingInvoice[],
      "61-90": [] as AgingInvoice[],
      "90+": [] as AgingInvoice[],
    }

    for (const invoice of unpaidInvoices) {
      const dueDate = new Date(invoice.dueDate)
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / dayMs)

      let bucket: keyof typeof buckets
      if (daysOverdue <= 0) bucket = "current"
      else if (daysOverdue <= 30) bucket = "1-30"
      else if (daysOverdue <= 60) bucket = "31-60"
      else if (daysOverdue <= 90) bucket = "61-90"
      else bucket = "90+"

      buckets[bucket].push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.client.id,
        clientName: invoice.client.companyName,
        clientEmail: invoice.client.email,
        issuedDate: invoice.issuedDate,
        dueDate: invoice.dueDate,
        total: Number(invoice.total),
        daysOverdue: Math.max(0, daysOverdue),
        bucket,
      })
    }

    const summary = {
      current: {
        count: buckets.current.length,
        total: buckets.current.reduce((s, i) => s + i.total, 0),
      },
      "1-30": {
        count: buckets["1-30"].length,
        total: buckets["1-30"].reduce((s, i) => s + i.total, 0),
      },
      "31-60": {
        count: buckets["31-60"].length,
        total: buckets["31-60"].reduce((s, i) => s + i.total, 0),
      },
      "61-90": {
        count: buckets["61-90"].length,
        total: buckets["61-90"].reduce((s, i) => s + i.total, 0),
      },
      "90+": {
        count: buckets["90+"].length,
        total: buckets["90+"].reduce((s, i) => s + i.total, 0),
      },
    }

    const totalOutstanding = Object.values(summary).reduce(
      (s, b) => s + b.total,
      0
    )

    return NextResponse.json({
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalInvoices: unpaidInvoices.length,
      summary,
      invoices: [...buckets.current, ...buckets["1-30"], ...buckets["31-60"], ...buckets["61-90"], ...buckets["90+"]],
    })
  } catch (error: unknown) {
    console.error("Aging report error:", error)
    return NextResponse.json(
      { error: "Failed to generate aging report" },
      { status: 500 }
    )
  }
}
