import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/db"
import { ExpenseStatus } from "@prisma/client"

/**
 * GET /api/expenses
 * 
 * List expenses with optional filters
 * 
 * Query params:
 * - status: Filter by status (DRAFT, SUBMITTED, APPROVED, REJECTED, REIMBURSED)
 * - clientId: Filter by client
 * - retainerId: Filter by retainer
 * - startDate: Filter by date >= startDate
 * - endDate: Filter by date <= endDate
 * - submittedBy: Filter by submitter user ID
 * - page: Page number (default 1)
 * - limit: Items per page (default 25)
 * 
 * Admin/Staff: See all expenses for tenant
 * Client: See only their own submissions (if schema supports)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") as ExpenseStatus | null
    const clientId = searchParams.get("clientId")
    const retainerId = searchParams.get("retainerId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const submittedBy = searchParams.get("submittedBy")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "25")
    const skip = (page - 1) * limit

    // Build query filters
    const where: any = { tenantId: session.user.tenantId }

    // Non-admin users only see their own expenses
    if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
      where.userId = session.user.id
    }

    if (status) {
      where.status = status
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (retainerId) {
      where.retainerId = retainerId
    }

    if (submittedBy) {
      where.userId = submittedBy
    }

    if (startDate || endDate) {
      where.expenseDate = {}
      if (startDate) {
        where.expenseDate.gte = new Date(startDate)
      }
      if (endDate) {
        where.expenseDate.lte = new Date(endDate)
      }
    }

    // Execute query
    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          expenseDate: "desc",
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          retainer: {
            select: {
              id: true,
              name: true,
            },
          },
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
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              uploadedAt: true,
            },
          },
        },
      }),
      prisma.expense.count({ where }),
    ])

    return NextResponse.json({
      data: expenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: any) {
    console.error("Error fetching expenses:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch expenses" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/expenses
 * 
 * Create new expense
 * 
 * All authenticated users can create
 * 
 * Body:
 * - categoryId: string (required)
 * - clientId: string (required)
 * - expenseDate: string (ISO date, required)
 * - amount: number (required)
 * - description: string (required)
 * - retainerId?: string
 * - isBillable: boolean (default true)
 * - isReimbursable: boolean (default false)
 * - merchant?: string
 * - internalNotes?: string
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      categoryId,
      clientId,
      expenseDate,
      amount,
      description,
      retainerId,
      isBillable = true,
      isReimbursable = false,
      merchant,
      internalNotes,
    } = body

    // Validate required fields
    if (!categoryId || !clientId || !expenseDate || amount === undefined || !description) {
      return NextResponse.json(
        {
          error: "categoryId, clientId, expenseDate, amount, and description are required",
        },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      )
    }

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

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId, tenantId: session.user.tenantId },
    })
    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      )
    }

    // Verify retainer if provided
    if (retainerId) {
      const retainer = await prisma.retainer.findUnique({
        where: { id: retainerId, tenantId: session.user.tenantId },
      })
      if (!retainer) {
        return NextResponse.json(
          { error: "Retainer not found" },
          { status: 404 }
        )
      }
    }

    // Create expense
    const expense = await prisma.expense.create({
      data: {
        tenantId: session.user.tenantId,
        categoryId,
        clientId,
        expenseDate: new Date(expenseDate),
        amount,
        description,
        retainerId,
        isBillable,
        isReimbursable,
        merchant,
        internalNotes,
        status: "DRAFT",
        userId: session.user.id,
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
      },
    })

    return NextResponse.json({
      success: true,
      data: expense,
    })
  } catch (error: any) {
    console.error("Error creating expense:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create expense" },
      { status: 500 }
    )
  }
}
