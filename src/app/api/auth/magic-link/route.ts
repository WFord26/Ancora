import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/db"
import crypto from "crypto"
import { sendMagicLinkEmail } from "@/lib/email"

/**
 * POST /api/auth/magic-link
 * 
 * Generate a magic login link for client portal access.
 * 
 * Body:
 * - email: string (required)
 * 
 * Flow:
 * 1. Verify user exists with CLIENT role
 * 2. Generate secure random token
 * 3. Store in VerificationToken table (15-minute expiry)
 * 4. Send email with link (placeholder: logs to console)
 * 5. Return success (never reveal if email exists)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: "If an account exists with that email, a login link has been sent.",
    })

    // Find user with CLIENT role
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, role: true, isActive: true, tenantId: true },
    })

    if (!user || user.role !== "CLIENT" || !user.isActive) {
      // Don't reveal that account doesn't exist
      return successResponse
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex")

    // Set expiry to 15 minutes
    const expires = new Date(Date.now() + 15 * 60 * 1000)

    // Clean up any existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    })

    // Store token
    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        expires,
      },
    })

    // Build magic link URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const magicLink = `${baseUrl}/api/auth/magic-link/verify?token=${token}&email=${encodeURIComponent(normalizedEmail)}`

    // Send magic link email
    await sendMagicLinkEmail({ to: normalizedEmail, loginUrl: magicLink })

    // Also log in development for debugging
    if (process.env.NODE_ENV === "development") {
      console.log("========================================")
      console.log("  MAGIC LINK LOGIN")
      console.log(`  Email: ${normalizedEmail}`)
      console.log(`  Link: ${magicLink}`)
      console.log(`  Expires: ${expires.toISOString()}`)
      console.log("========================================")
    }

    return successResponse
  } catch (error: any) {
    console.error("Error generating magic link:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}
