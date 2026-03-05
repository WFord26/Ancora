import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/db"

/**
 * POST /api/expenses/[id]/reimburse
 * 
 * Mark expense as reimbursed (APPROVED → REIMBURSED)
 * 
 * Admin/Staff only
 * 
 * Body:
 * - reimbursementDate?: string (ISO date, defaults to now)
 * - reimbursementMethod?: string (e.g., "check", "direct deposit", "payroll")
 * - reimbursementReference?: string (e.g., check number, transaction ID)
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

    if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
      return NextResponse.json(
        { error: "Admin or Staff access required" },
        { status: 403 }
      )
    }

    const expenseId = params.id
    const body = await request.json()
    const { reimbursementDate, reimbursementMethod, reimbursementReference } =
      body

    // Verify expense exists
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId, tenantId: session.user.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Must be APPROVED and isReimbursable
    if (existing.status !== "APPROVED") {
      return NextResponse.json(
        {
          error: `Cannot reimburse ${existing.status} expense. Only APPROVED expenses can be reimbursed.`,
        },
        { status: 400 }
      )
    }

    if (!existing.isReimbursable) {
      return NextResponse.json(
        { error: "This expense is not marked as reimbursable" },
        { status: 400 }
      )
    }

    // Build reimbursement notes
    let reimbursementNotes = ""
    if (reimbursementMethod || reimbursementReference) {
      reimbursementNotes = `Reimbursement: ${reimbursementMethod || "N/A"} (Ref: ${reimbursementReference || "N/A"})`
    }

    // Update status to REIMBURSED
    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: "REIMBURSED",
        // Store reimbursement details in internal notes field
        internalNotes: existing.internalNotes
          ? `${existing.internalNotes}\n\n${reimbursementNotes}`
          : reimbursementNotes || undefined,
      },
      include: {
        category: true,
        client: true,
        retainer: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        documents: true,
      },
    })

    // TODO: Send notification to submitter

    return NextResponse.json({
      success: true,
      message: "Expense marked as reimbursed",
      data: expense,
    })
  } catch (error: any) {
    console.error("Error marking expense reimbursed:", error)
    return NextResponse.json(
      { error: error.message || "Failed to mark expense as reimbursed" },
      { status: 500 }
    )
  }
}
