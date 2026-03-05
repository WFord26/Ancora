import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/db"

/**
 * POST /api/expenses/[id]/submit
 * 
 * Submit expense for approval (DRAFT → SUBMITTED)
 * 
 * Only expense owner can submit
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

    const expenseId = params.id

    // Verify expense exists
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId, tenantId: session.user.tenantId },
      include: {
        category: true,
        documents: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Check permissions - only owner can submit
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Can only submit DRAFT or REJECTED expenses
    if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
      return NextResponse.json(
        {
          error: `Cannot submit ${existing.status} expense. Only DRAFT or REJECTED expenses can be submitted.`,
        },
        { status: 400 }
      )
    }

    // Update status to SUBMITTED
    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: "SUBMITTED",
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
        documents: true,
      },
    })

    // TODO: Send notification to admins/approvers

    return NextResponse.json({
      success: true,
      message: "Expense submitted for approval",
      data: expense,
    })
  } catch (error: any) {
    console.error("Error submitting expense:", error)
    return NextResponse.json(
      { error: error.message || "Failed to submit expense" },
      { status: 500 }
    )
  }
}
