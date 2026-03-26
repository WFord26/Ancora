import { prisma } from "@/db"
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { sendWelcomeEmail } from "@/lib/email"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { getBootstrapState, slugifyTenantName } from "@/lib/bootstrap"
import { DEFAULT_TIMEZONE } from "@/lib/timezone-options"

const setupSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(120),
  contactName: z.string().trim().min(1, "Contact name is required").max(120),
  email: z.string().trim().email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  timezone: z.string().trim().min(1).default(DEFAULT_TIMEZONE),
})

/**
 * POST /api/auth/setup
 * Creates the first production tenant + admin during bootstrap
 */
export async function POST(request: NextRequest) {
  try {
    const bootstrapState = await getBootstrapState()

    if (!bootstrapState.isProduction) {
      return NextResponse.json(
        { error: "The first-time installer is only available in production." },
        { status: 403 }
      )
    }

    if (bootstrapState.isInstalled) {
      return NextResponse.json(
        { error: "Ancora has already been installed for this database." },
        { status: 409 }
      )
    }

    const payload = setupSchema.safeParse(await request.json())

    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.errors[0]?.message || "Invalid setup payload" },
        { status: 400 }
      )
    }

    const { companyName, contactName, email, password, timezone } = payload.data
    const passwordHash = await bcrypt.hash(password, 12)

    const result = await prisma.$transaction(async (tx) => {
      const [tenantCount, userCount, existingUser] = await Promise.all([
        tx.tenant.count(),
        tx.user.count(),
        tx.user.findUnique({
          where: { email },
        }),
      ])

      if (tenantCount > 0 || userCount > 0) {
        throw new Error("Ancora has already been installed for this database.")
      }

      if (existingUser) {
        throw new Error("Email already registered")
      }

      const baseSlug = slugifyTenantName(companyName)
      let finalSlug = baseSlug
      let counter = 1

      while (await tx.tenant.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${baseSlug}-${counter}`
        counter += 1
      }

      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
          slug: finalSlug,
          timezone,
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
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    const welcomeEmail = await sendWelcomeEmail({
      to: email,
      name: contactName,
      companyName,
      dashboardUrl: process.env.NEXTAUTH_URL,
    })

    return NextResponse.json(
      {
        message: "Ancora installed successfully",
        emailDelivered: welcomeEmail.success,
        tenant: result.tenant,
        user: result.user,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Setup error:", error)

    if (error?.message === "Ancora has already been installed for this database.") {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    if (error?.message === "Email already registered") {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Failed to create account" },
      { status: 500 }
    )
  }
}
