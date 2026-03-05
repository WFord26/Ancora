import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/db"
import { encode } from "next-auth/jwt"
import { cookies } from "next/headers"

/**
 * GET /api/auth/magic-link/verify
 * 
 * Verify a magic link token and sign the user in.
 * 
 * Query params:
 * - token: string (the magic link token)
 * - email: string (the user's email)
 * 
 * Flow:
 * 1. Look up token in VerificationToken table
 * 2. Check expiry
 * 3. Find associated user
 * 4. Create JWT session token
 * 5. Set session cookie
 * 6. Delete used token
 * 7. Redirect to /portal
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    const email = searchParams.get("email")

    if (!token || !email) {
      return redirectWithError("Invalid login link. Please request a new one.")
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Find and validate token
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        token,
      },
    })

    if (!verificationToken) {
      return redirectWithError("Invalid or expired login link. Please request a new one.")
    }

    // Check expiry
    if (verificationToken.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: normalizedEmail,
            token,
          },
        },
      })
      return redirectWithError("This login link has expired. Please request a new one.")
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { tenant: true },
    })

    if (!user || !user.isActive || user.role !== "CLIENT") {
      return redirectWithError("Account not found or inactive.")
    }

    // Delete used token (one-time use)
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: normalizedEmail,
          token,
        },
      },
    })

    // Create JWT session token (same structure as credentials login)
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
      throw new Error("NEXTAUTH_SECRET is not set")
    }

    const sessionToken = await encode({
      token: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        timezone: user.timezone || user.tenant.timezone,
        sub: user.id,
      },
      secret,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    // Set session cookie
    const cookieStore = await cookies()
    const isSecure = process.env.NEXTAUTH_URL?.startsWith("https") || false
    const cookieName = isSecure
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token"

    cookieStore.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    // Redirect to portal
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    return NextResponse.redirect(`${baseUrl}/portal`)
  } catch (error: any) {
    console.error("Magic link verification error:", error)
    return redirectWithError("An error occurred. Please request a new login link.")
  }
}

function redirectWithError(message: string): NextResponse {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const url = new URL("/portal/login", baseUrl)
  url.searchParams.set("error", message)
  return NextResponse.redirect(url.toString())
}
