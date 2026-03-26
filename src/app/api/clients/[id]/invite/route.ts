import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/db"
import { sendClientInvitationEmail } from "@/lib/email"
import crypto from "crypto"

/**
 * POST /api/clients/[id]/invite
 * Invite a client to view their retainer in the portal
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id?: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Only ADMIN and STAFF can invite clients
    if (!["ADMIN", "STAFF"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      )
    }

    const clientId = params?.id
    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      )
    }

    const { email, clientName } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Verify client exists and belongs to tenant
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    })

    if (!client || client.tenantId !== session.user.tenantId) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      )
    }

    // Check if invitation already exists and is not accepted
    const existingInvitation = await prisma.clientInvitation.findFirst({
      where: {
        email,
        clientId,
        acceptedAt: null,
        isActive: true,
      },
    })

    if (existingInvitation) {
      return NextResponse.json(
        { error: "Active invitation already exists for this email" },
        { status: 400 }
      )
    }

    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString("hex")

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
    })

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      )
    }

    // Create invitation
    const invitation = await prisma.clientInvitation.create({
      data: {
        tenantId: session.user.tenantId,
        clientId,
        email,
        invitedBy: session.user.id,
        invitationToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    })

    // Get app URL
    const protocol = request.headers.get("x-forwarded-proto") || "http"
    const host = request.headers.get("host") || "localhost:3000"
    const appUrl = `${protocol}://${host}`

    // Send invitation email
    await sendClientInvitationEmail({
      to: email,
      clientName: clientName || email,
      tenantName: tenant.name,
      invitedByName: currentUser.name || currentUser.email,
      invitationUrl: `${appUrl}/auth/landing/accept-client-invite?token=${invitationToken}`,
    })

    return NextResponse.json(
      {
        message: "Client invitation sent successfully",
        invitation: {
          id: invitation.id,
          email: invitation.email,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Send client invitation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send client invitation" },
      { status: 500 }
    )
  }
}
