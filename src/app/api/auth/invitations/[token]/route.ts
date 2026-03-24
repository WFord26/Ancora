import { prisma } from "@/db"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/auth/invitations/[token]
 * Verify and get invitation details
 */
export async function GET(
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

    const invitation = await prisma.tenantInvitation.findUnique({
      where: { invitationToken: token },
      include: {
        tenant: true,
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

    return NextResponse.json({ invitation }, { status: 200 })
  } catch (error: any) {
    console.error("Get invitation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch invitation" },
      { status: 500 }
    )
  }
}
