import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/db"

/**
 * GET /api/expenses/[id]
 * 
 * Get expense details
 * 
 * Admin/Staff: Can view any expense
 * Others: Can only view their own expenses
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

    const expenseId = params.id

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId, tenantId: session.user.tenantId },
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
        documents: {
          orderBy: { uploadedAt: "desc" },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
          },
        },
      },
    })

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Non-admin/staff can only view their own expenses
    if (
      session.user.role !== "ADMIN" &&
      session.user.role !== "STAFF" &&
      expense.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ data: expense })
  } catch (error: any) {
    console.error("Error fetching expense:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch expense" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/expenses/[id]
 * 
 * Update expense
 * 
 * Admin/Staff: Can update any expense (except APPROVED/REIMBURSED)
 * Others: Can only update their own DRAFT/REJECTED expenses
 * 
 * Body: Any expense fields to update
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

    const expenseId = params.id
    const body = await request.json()
    const {
      categoryId,
      expenseDate,
      amount,
      description,
      clientId,
      retainerId,
      isBillable,
      isReimbursable,
      merchant,
      internalNotes,
    } = body

    // Verify expense exists
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId, tenantId: session.user.tenantId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Check permissions
    const isOwner = existing.userId === session.user.id
    const isAdminOrStaff =
      session.user.role === "ADMIN" || session.user.role === "STAFF"

    if (!isAdminOrStaff && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Can only edit DRAFT or REJECTED expenses
    if (
      existing.status !== "DRAFT" &&
      existing.status !== "REJECTED" &&
      !isAdminOrStaff
    ) {
      return NextResponse.json(
        {
          error: `Cannot edit ${existing.status} expense. Only DRAFT or REJECTED expenses can be edited.`,
        },
        { status: 400 }
      )
    }

    // Admin/Staff cannot edit APPROVED or REIMBURSED expenses
    if (
      (existing.status === "APPROVED" || existing.status === "REIMBURSED") &&
      isAdminOrStaff
    ) {
      return NextResponse.json(
        {
          error: `Cannot edit ${existing.status} expense`,
        },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: any = {}

    if (categoryId !== undefined) {
      // Verify category exists
      const category = await prisma.expenseCategory.findUnique({
        where: { id: categoryId, tenantId: session.user.tenantId },
      })
      if (!category) {
        return NextResponse.json(
          { error: "Expense category not found" },
          { status: 404 }
        )
      }
      updateData.categoryId = categoryId
    }

    if (expenseDate !== undefined) updateData.expenseDate = new Date(expenseDate)
    if (amount !== undefined) {
      if (amount <= 0) {
        return NextResponse.json(
          { error: "Amount must be greater than 0" },
          { status: 400 }
        )
      }
      updateData.amount = amount
    }
    if (description !== undefined) updateData.description = description
    if (clientId !== undefined) updateData.clientId = clientId
    if (retainerId !== undefined) updateData.retainerId = retainerId
    if (isBillable !== undefined) updateData.isBillable = isBillable
    if (isReimbursable !== undefined) updateData.isReimbursable = isReimbursable
    if (merchant !== undefined) updateData.merchant = merchant
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes

    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: updateData,
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

    return NextResponse.json({
      success: true,
      data: expense,
    })
  } catch (error: any) {
    console.error("Error updating expense:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update expense" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/expenses/[id]
 * 
 * Delete expense (DRAFT only)
 * 
 * Admin/Staff: Can delete any DRAFT expense
 * Others: Can only delete their own DRAFT expenses
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

    const expenseId = params.id

    // Verify expense exists
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId, tenantId: session.user.tenantId },
      include: {
        documents: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Check permissions
    const isOwner = existing.userId === session.user.id
    const isAdminOrStaff =
      session.user.role === "ADMIN" || session.user.role === "STAFF"

    if (!isAdminOrStaff && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Can only delete DRAFT expenses
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only delete DRAFT expenses" },
        { status: 400 }
      )
    }

    // Delete associated documents first (cascade should handle this, but being explicit)
    if (existing.documents.length > 0) {
      await prisma.expenseDocument.deleteMany({
        where: { expenseId },
      })
      // TODO: Delete actual files from Azure Blob Storage
    }

    // Delete expense
    await prisma.expense.delete({
      where: { id: expenseId },
    })

    return NextResponse.json({
      success: true,
      message: "Expense deleted",
    })
  } catch (error: any) {
    console.error("Error deleting expense:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete expense" },
      { status: 500 }
    )
  }
}
