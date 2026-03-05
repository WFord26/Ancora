import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/db"
import {
  validateFile,
  generateExpenseBlobPath,
  getStorageHandler,
} from "@/lib/storage"

/**
 * GET /api/expenses/[id]/documents
 * 
 * List all documents for an expense
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

    // Verify expense exists and user has access
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId, tenantId: session.user.tenantId },
      select: { userId: true },
    })

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Non-admin/staff can only see their own expense documents
    if (
      session.user.role !== "ADMIN" &&
      session.user.role !== "STAFF" &&
      expense.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const documents = await prisma.expenseDocument.findMany({
      where: { expenseId },
      orderBy: { uploadedAt: "desc" },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Generate download URLs
    const storage = getStorageHandler()
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        downloadUrl: await storage.generateSasUrl(doc.blobUrl),
      }))
    )

    return NextResponse.json({ data: documentsWithUrls })
  } catch (error: any) {
    console.error("Error fetching expense documents:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch documents" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/expenses/[id]/documents
 * 
 * Upload a document to an expense
 * 
 * Accepts multipart/form-data with:
 * - file: The file to upload
 * - isReceipt: boolean (default true)
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
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId, tenantId: session.user.tenantId },
      select: { userId: true, status: true },
    })

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    // Only owner or admin/staff can upload documents
    const isOwner = expense.userId === session.user.id
    const isAdminOrStaff =
      session.user.role === "ADMIN" || session.user.role === "STAFF"

    if (!isOwner && !isAdminOrStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Can only upload to DRAFT or REJECTED expenses
    if (expense.status !== "DRAFT" && expense.status !== "REJECTED") {
      return NextResponse.json(
        { error: "Can only upload documents to DRAFT or REJECTED expenses" },
        { status: 400 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const isReceipt = formData.get("isReceipt") !== "false"

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate file
    const validation = validateFile(file.name, file.size, file.type)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate blob path and upload
    const blobPath = generateExpenseBlobPath(
      session.user.tenantId,
      expenseId,
      file.name
    )

    const storage = getStorageHandler()
    const uploadResult = await storage.upload(blobPath, buffer, file.type)

    // Create document record
    const document = await prisma.expenseDocument.create({
      data: {
        expenseId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        blobUrl: uploadResult.blobUrl,
        uploadedBy: session.user.id,
        isReceipt,
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Generate download URL
    const downloadUrl = await storage.generateSasUrl(uploadResult.blobUrl)

    return NextResponse.json({
      success: true,
      data: {
        ...document,
        downloadUrl,
      },
    })
  } catch (error: any) {
    console.error("Error uploading expense document:", error)
    return NextResponse.json(
      { error: error.message || "Failed to upload document" },
      { status: 500 }
    )
  }
}
