import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/db"

/**
 * GET /api/expense-categories
 * 
 * List all expense categories for tenant
 * 
 * All authenticated users can view
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const categories = await prisma.expenseCategory.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
    })

    return NextResponse.json({ data: categories })
  } catch (error: any) {
    console.error("Error fetching expense categories:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch expense categories" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/expense-categories
 * 
 * Create new expense category
 * 
 * Admin/Staff only
 * 
 * Body:
 * - name: string (required)
 * - color?: string (hex color, default #6366f1)
 * - glAccount?: string (for accounting integration)
 * - sortOrder?: number (default 0)
 * - isActive: boolean (default true)
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
    const {
      name,
      color = "#6366f1",
      glAccount,
      sortOrder = 0,
      isActive = true,
    } = body

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      )
    }

    // Check for duplicate name
    const existing = await prisma.expenseCategory.findFirst({
      where: {
        tenantId: session.user.tenantId,
        name: name.trim(),
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 409 }
      )
    }

    const category = await prisma.expenseCategory.create({
      data: {
        tenantId: session.user.tenantId,
        name: name.trim(),
        color,
        glAccount,
        sortOrder,
        isActive,
      },
    })

    return NextResponse.json({
      success: true,
      data: category,
    })
  } catch (error: any) {
    console.error("Error creating expense category:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create expense category" },
      { status: 500 }
    )
  }
}
