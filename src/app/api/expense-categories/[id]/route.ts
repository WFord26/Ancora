import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/db"

/**
 * GET /api/expense-categories/[id]
 * 
 * Get expense category details
 * 
 * All authenticated users can view
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

    const categoryId = params.id

    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId, tenantId: session.user.tenantId },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
    })

    if (!category) {
      return NextResponse.json(
        { error: "Expense category not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: category })
  } catch (error: any) {
    console.error("Error fetching expense category:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch expense category" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/expense-categories/[id]
 * 
 * Update expense category
 * 
 * Admin/Staff only
 * 
 * Body:
 * - name?: string
 * - color?: string
 * - glAccount?: string
 * - sortOrder?: number
 * - isActive?: boolean
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

    const categoryId = params.id
    const body = await request.json()
    const { name, color, glAccount, sortOrder, isActive } = body

    // Verify category exists
    const existing = await prisma.expenseCategory.findUnique({
      where: { id: categoryId, tenantId: session.user.tenantId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Expense category not found" },
        { status: 404 }
      )
    }

    // Check for duplicate name if changing name
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.expenseCategory.findFirst({
        where: {
          tenantId: session.user.tenantId,
          name: name.trim(),
          id: { not: categoryId },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 409 }
        )
      }
    }

    // Build update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (color !== undefined) updateData.color = color
    if (glAccount !== undefined) updateData.glAccount = glAccount
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder
    if (isActive !== undefined) updateData.isActive = isActive

    const category = await prisma.expenseCategory.update({
      where: { id: categoryId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: category,
    })
  } catch (error: any) {
    console.error("Error updating expense category:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update expense category" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/expense-categories/[id]
 * 
 * Delete expense category (if no expenses attached)
 * 
 * Admin only
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

    const categoryId = params.id

    // Check if category has any expenses
    const expenseCount = await prisma.expense.count({
      where: { categoryId },
    })

    if (expenseCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category with ${expenseCount} expense(s). Set as inactive instead.`,
        },
        { status: 400 }
      )
    }

    await prisma.expenseCategory.delete({
      where: { id: categoryId, tenantId: session.user.tenantId },
    })

    return NextResponse.json({
      success: true,
      message: "Expense category deleted",
    })
  } catch (error: any) {
    console.error("Error deleting expense category:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete expense category" },
      { status: 500 }
    )
  }
}
