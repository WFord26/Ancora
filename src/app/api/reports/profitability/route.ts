import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"

/**
 * GET /api/reports/profitability
 * 
 * Returns profitability data per client.
 * Revenue = retainer fees + overage charges + billable expenses
 * Cost = hours worked × internal cost (estimated from time entries)
 * 
 * Query params:
 *   - from: ISO date string (default: 12 months ago)
 *   - to: ISO date string (default: now)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const twelveMonthsAgo = new Date(now)
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const from = searchParams.get("from")
      ? new Date(searchParams.get("from") as string)
      : twelveMonthsAgo
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to") as string)
      : now

    // Get clients with their invoices and time entries in the date range
    const clients = await prisma.client.findMany({
      where: {
        tenantId: session.user.tenantId,
        isActive: true,
      },
      include: {
        invoices: {
          where: {
            issuedDate: { gte: from, lte: to },
            status: { in: ["SENT", "PAID"] },
          },
          select: {
            id: true,
            total: true,
            status: true,
            issuedDate: true,
          },
        },
        retainers: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            ratePerHour: true,
            includedHours: true,
          },
        },
        timeEntries: {
          where: {
            startTime: { gte: from, lte: to },
            isBillable: true,
          },
          select: {
            durationMinutes: true,
          },
        },
        expenses: {
          where: {
            expenseDate: { gte: from, lte: to },
            isBillable: true,
            status: { in: ["APPROVED", "REIMBURSED"] },
          },
          select: {
            amount: true,
          },
        },
      },
    })

    const profitability = clients.map((client) => {
      const totalRevenue = client.invoices.reduce(
        (sum: number, inv: { total: unknown }) => sum + Number(inv.total),
        0
      )
      const paidRevenue = client.invoices
        .filter((inv: { status: string }) => inv.status === "PAID")
        .reduce(
          (sum: number, inv: { total: unknown }) => sum + Number(inv.total),
          0
        )
      const totalHours = client.timeEntries.reduce(
        (sum: number, te: { durationMinutes: number }) => sum + te.durationMinutes / 60,
        0
      )
      const totalExpenses = client.expenses.reduce(
        (sum: number, exp: { amount: unknown }) => sum + Number(exp.amount),
        0
      )

      // Effective hourly rate = revenue / hours worked
      const effectiveRate = totalHours > 0
        ? Math.round((totalRevenue / totalHours) * 100) / 100
        : 0

      // Retainer rate for comparison
      const avgRetainerRate = client.retainers.length > 0
        ? client.retainers.reduce(
            (sum: number, r: { ratePerHour: unknown }) => sum + Number(r.ratePerHour),
            0
          ) / client.retainers.length
        : 0

      return {
        clientId: client.id,
        clientName: client.companyName,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        paidRevenue: Math.round(paidRevenue * 100) / 100,
        outstandingRevenue: Math.round((totalRevenue - paidRevenue) * 100) / 100,
        totalHoursWorked: Math.round(totalHours * 10) / 10,
        totalBillableExpenses: Math.round(totalExpenses * 100) / 100,
        effectiveHourlyRate: effectiveRate,
        contractedRate: Math.round(avgRetainerRate * 100) / 100,
        invoiceCount: client.invoices.length,
        activeRetainers: client.retainers.length,
      }
    })

    // Sort by total revenue descending
    profitability.sort((a, b) => b.totalRevenue - a.totalRevenue)

    const summary = {
      totalRevenue: profitability.reduce((s, c) => s + c.totalRevenue, 0),
      totalPaid: profitability.reduce((s, c) => s + c.paidRevenue, 0),
      totalHours: profitability.reduce((s, c) => s + c.totalHoursWorked, 0),
      clientCount: profitability.length,
    }

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      summary,
      clients: profitability,
    })
  } catch (error: unknown) {
    console.error("Profitability report error:", error)
    return NextResponse.json(
      { error: "Failed to generate profitability report" },
      { status: 500 }
    )
  }
}
