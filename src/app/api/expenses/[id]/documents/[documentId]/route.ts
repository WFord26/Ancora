import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/db"
import { getStorageHandler } from "@/lib/storage"

/**
 * GET /api/expenses/[id]/documents/[documentId]
 * 
 * Download a specific expense document (returns redirect to SAS URL or stream)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: expenseId, documentId } = params

    // Verify expense exists and user has access
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId, tenantId: session.user.tenantId },
      select: { userId: true },
    })

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Non-admin/staff can only access their own expense documents
    if (
      session.user.role !== "ADMIN" &&
      session.user.role !== "STAFF" &&
      expense.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get document record
    const document = await prisma.expenseDocument.findUnique({
      where: { id: documentId },
    })

    if (!document || document.expenseId !== expenseId) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    // Generate SAS URL and redirect
    const storage = getStorageHandler()
    const downloadUrl = await storage.generateSasUrl(document.blobUrl)

    return NextResponse.json({
      data: {
        ...document,
        downloadUrl,
      },
    })
  } catch (error: any) {
    console.error("Error fetching document:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch document" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/expenses/[id]/documents/[documentId]
 * 
 * Delete an expense document
 * 
 * Admin/Staff or document owner
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: expenseId, documentId } = params

    // Verify expense exists
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId, tenantId: session.user.tenantId },
      select: { userId: true, status: true },
    })

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Check permissions
    const isOwner = expense.userId === session.user.id
    const isAdminOrStaff =
      session.user.role === "ADMIN" || session.user.role === "STAFF"

    if (!isOwner && !isAdminOrStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Can only delete documents from DRAFT or REJECTED expenses
    if (expense.status !== "DRAFT" && expense.status !== "REJECTED") {
      return NextResponse.json(
        {
          error:
            "Can only delete documents from DRAFT or REJECTED expenses",
        },
        { status: 400 }
      )
    }

    // Get document record
    const document = await prisma.expenseDocument.findUnique({
      where: { id: documentId },
    })

    if (!document || document.expenseId !== expenseId) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    // Delete from storage
    const storage = getStorageHandler()
    await storage.delete(document.blobUrl)

    // Delete document record
    await prisma.expenseDocument.delete({
      where: { id: documentId },
    })

    return NextResponse.json({
      success: true,
      message: "Document deleted",
    })
  } catch (error: any) {
    console.error("Error deleting document:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete document" },
      { status: 500 }
    )
  }
}
