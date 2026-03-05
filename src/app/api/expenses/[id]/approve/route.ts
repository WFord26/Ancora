import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/db"

/**
 * POST /api/expenses/[id]/approve
 * 
 * Approve expense (SUBMITTED → APPROVED)
 * 
 * Admin/Staff only
 * 
 * Body:
 * - notes?: string (approval notes)
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
    const { notes } = body

    // Verify expense exists
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId, tenantId: session.user.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Can only approve SUBMITTED expenses
    if (existing.status !== "SUBMITTED") {
      return NextResponse.json(
        {
          error: `Cannot approve ${existing.status} expense. Only SUBMITTED expenses can be approved.`,
        },
        { status: 400 }
      )
    }

    // Update status to APPROVED
    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: "APPROVED",
        approvedBy: session.user.id,
        approvedAt: new Date(),
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
      message: "Expense approved",
      data: expense,
    })
  } catch (error: any) {
    console.error("Error approving expense:", error)
    return NextResponse.json(
      { error: error.message || "Failed to approve expense" },
      { status: 500 }
    )
  }
}
