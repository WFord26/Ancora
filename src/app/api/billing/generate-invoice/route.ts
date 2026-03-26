import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { generateInvoicesForClosedPeriod } from "@/lib/invoice"

/**
 * POST /api/billing/generate-invoice
 * 
 * Generate invoice for a closed retainer period
 * 
 * Admin/Staff only
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
    const { retainerPeriodId, dueInDays } = body

    if (!retainerPeriodId) {
      return NextResponse.json(
        { error: "retainerPeriodId is required" },
        { status: 400 }
      )
    }

    const result = await generateInvoicesForClosedPeriod(
      retainerPeriodId,
      session.user.tenantId,
      dueInDays === undefined
        ? undefined
        : {
            monthlyDueInDays: dueInDays,
            biweeklyDueInDays: dueInDays,
          }
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error("Error generating invoice:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate invoice" },
      { status: 500 }
    )
  }
}
