import { prisma } from "@/db"
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { sendWelcomeEmail } from "@/lib/email"

/**
 * POST /api/auth/setup
 * Creates a new tenant with admin user for sign-ups
 */
export async function POST(request: NextRequest) {
  try {
    const { companyName, contactName, email, password } = await request.json()

    // Validate inputs
    if (!companyName || !contactName || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create tenant with slug from company name
    const slug = companyName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")

    // Ensure unique slug
    let finalSlug = slug
    let counter = 1
    while (true) {
      const existing = await prisma.tenant.findUnique({
        where: { slug: finalSlug },
      })
      if (!existing) break
      finalSlug = `${slug}-${counter}`
      counter++
    }

    // Create tenant and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
          slug: finalSlug,
        },
      })

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          name: contactName,
          role: "ADMIN",
          passwordHash,
          isActive: true,
        },
      })

      return { tenant, user }
    })

    // Send welcome email
    await sendWelcomeEmail({
      to: email,
      name: contactName,
      companyName,
    })

    return NextResponse.json(
      {
        message: "Account created successfully",
        tenant: result.tenant,
        user: result.user,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Setup error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create account" },
      { status: 500 }
    )
  }
}
