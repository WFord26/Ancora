import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/db"

/**
 * POST /api/expenses/[id]/reject
 * 
 * Reject expense (SUBMITTED → REJECTED)
 * 
 * Admin/Staff only
 * 
 * Body:
 * - reason: string (required - rejection reason)
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
    const { reason } = body

    if (!reason || reason.trim() === "") {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      )
    }

    // Verify expense exists
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId, tenantId: session.user.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Can only reject SUBMITTED expenses
    if (existing.status !== "SUBMITTED") {
      return NextResponse.json(
        {
          error: `Cannot reject ${existing.status} expense. Only SUBMITTED expenses can be rejected.`,
        },
        { status: 400 }
      )
    }

    // Update status to REJECTED
    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: "REJECTED",
        approvedBy: session.user.id,
        approvedAt: new Date(),
        rejectedReason: reason,
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

    // TODO: Send notification to submitter with rejection reason

    return NextResponse.json({
      success: true,
      message: "Expense rejected",
      data: expense,
    })
  } catch (error: any) {
    console.error("Error rejecting expense:", error)
    return NextResponse.json(
      { error: error.message || "Failed to reject expense" },
      { status: 500 }
    )
  }
}
