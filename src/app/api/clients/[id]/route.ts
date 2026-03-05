import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { z } from "zod"

// GET /api/clients/[id] - Get client by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log('[GET /api/clients/[id]] Fetching client:', params.id, 'for tenant:', session.user.tenantId)

    const client = await prisma.client.findFirst({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
      include: {
        retainers: {
          include: {
            periods: {
              where: { status: "OPEN" },
              orderBy: { periodStart: "desc" },
              take: 1,
            },
          },
        },
        invoices: {
          orderBy: { issuedDate: "desc" },
          take: 5,
        },
      },
    })

    if (!client) {
      console.log('[GET /api/clients/[id]] Client not found:', params.id)
      return NextResponse.json(
        { success: false, error: "Client not found" },
        { status: 404 }
      )
    }

    console.log('[GET /api/clients/[id]] Client found:', client.companyName)
    return NextResponse.json({
      success: true,
      data: client,
    })
  } catch (error) {
    console.error("Error fetching client:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch client" },
      { status: 500 }
    )
  }
}

// PATCH /api/clients/[id] - Update client
const updateClientSchema = z.object({
  companyName: z.string().min(1).optional(),
  primaryContactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  billingEmail: z.string().email().optional().or(z.literal("")),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
})

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

    const body = await request.json()
    const validatedData = updateClientSchema.parse(body)

    const client = await prisma.client.update({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
      data: validatedData,
    })

    return NextResponse.json({
      success: true,
      data: client,
      message: "Client updated successfully",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating client:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update client" },
      { status: 500 }
    )
  }
}

// DELETE /api/clients/[id] - Soft delete client
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.client.update({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      message: "Client deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting client:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete client" },
      { status: 500 }
    )
  }
}
