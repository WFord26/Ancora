import { prisma } from "@/db"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/auth/client-invitations/[token]/accept
 * Accept a client invitation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token?: string } }
) {
  try {
    const token = params.token

    if (!token) {
      return NextResponse.json(
        { error: "Token required" },
        { status: 400 }
      )
    }

    const invitation = await prisma.clientInvitation.findUnique({
      where: { invitationToken: token },
      include: {
        tenant: true,
        client: true,
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      )
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 410 }
      )
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "Invitation has already been accepted" },
        { status: 400 }
      )
    }

    // Check if not active
    if (!invitation.isActive) {
      return NextResponse.json(
        { error: "Invitation is no longer active" },
        { status: 400 }
      )
    }

    // Check if user with this email already exists as a CLIENT in this tenant
    // If not, create a basic CLIENT user
    let user = await prisma.user.findFirst({
      where: {
        email: invitation.email,
        tenantId: invitation.tenantId,
      },
    })

    if (!user) {
      // Create a new CLIENT user with no password (they would need to set one via password reset or similar)
      user = await prisma.user.create({
        data: {
          tenantId: invitation.tenantId,
          email: invitation.email,
          role: "CLIENT",
          isActive: true,
          name: invitation.client.companyName,
        },
      })
    } else if (user.role !== "CLIENT") {
      // If user exists but isn't a CLIENT, reject
      return NextResponse.json(
        { error: "User already exists with different role" },
        { status: 400 }
      )
    }

    // Mark invitation as accepted
    await prisma.clientInvitation.update({
      where: { id: invitation.id },
      data: {
        acceptedAt: new Date(),
        acceptedUserId: user.id,
      },
    })

    return NextResponse.json(
      {
        message: "Invitation accepted successfully",
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Accept client invitation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to accept invitation" },
      { status: 500 }
    )
  }
}
