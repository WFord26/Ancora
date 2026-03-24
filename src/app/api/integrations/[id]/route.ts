import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { audit, AuditActions } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"

// DELETE /api/integrations/[id] - Disconnect an integration
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

    // Verify the connection belongs to this tenant before deleting
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
    })

    if (!connection) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      )
    }

    await prisma.integrationConnection.delete({
      where: { id: params.id },
    })

    await audit({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: AuditActions.INTEGRATION_DISCONNECTED,
      entityType: "IntegrationConnection",
      entityId: params.id,
      metadata: { provider: connection.provider },
      ipAddress: getIp(request),
    })

    return NextResponse.json({ success: true, message: "Integration disconnected" })
  } catch (error) {
    console.error("Error disconnecting integration:", error)
    return NextResponse.json(
      { success: false, error: "Failed to disconnect integration" },
      { status: 500 }
    )
  }
}

// PATCH /api/integrations/[id] - Update integration status (e.g. reactivate)
export async function PATCH(
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

    const connection = await prisma.integrationConnection.findFirst({
      where: {
        id: params.id,
        tenantId: session.user.tenantId,
      },
    })

    if (!connection) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const updated = await prisma.integrationConnection.update({
      where: { id: params.id },
      data: {
        status: body.status,
      },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error("Error updating integration:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update integration" },
      { status: 500 }
    )
  }
}
