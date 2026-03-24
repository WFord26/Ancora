import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/db"
import { sendTeamInvitationEmail } from "@/lib/email"
import crypto from "crypto"

/**
 * POST /api/invitations/send
 * Send invitation to team member
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Only ADMIN and STAFF can invite
    if (!["ADMIN", "STAFF"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      )
    }

    const { email, role = "STAFF" } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Check if user already exists in tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        tenantId: session.user.tenantId,
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists in this tenant" },
        { status: 400 }
      )
    }

    // Check if invitation already exists and is not accepted
    const existingInvitation = await prisma.tenantInvitation.findFirst({
      where: {
        email,
        tenantId: session.user.tenantId,
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

    // Get tenant and current user
    const [tenant, currentUser] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: session.user.tenantId } }),
      prisma.user.findUnique({ where: { id: session.user.id } }),
    ])

    if (!tenant || !currentUser) {
      return NextResponse.json(
        { error: "Tenant or user not found" },
        { status: 404 }
      )
    }

    // Create invitation
    const invitation = await prisma.tenantInvitation.create({
      data: {
        tenantId: session.user.tenantId,
        email,
        role,
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
    await sendTeamInvitationEmail({
      to: email,
      invitedByName: currentUser.name || currentUser.email,
      tenantName: tenant.name,
      invitationUrl: `${appUrl}/auth/landing/accept-invite?token=${invitationToken}`,
    })

    return NextResponse.json(
      {
        message: "Invitation sent successfully",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Send invitation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send invitation" },
      { status: 500 }
    )
  }
}
