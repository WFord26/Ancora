import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { z } from "zod"

// Settings validation schema
const settingsSchema = z.object({
  companyName: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  taxId: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  timezone: z.string().optional(),
})

// GET /api/settings - Retrieve tenant settings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN users can view settings
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        id: true,
        name: true,
        timezone: true,
        settings: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        timezone: tenant.timezone,
        settings: tenant.settings || {},
      },
    })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}

// PUT /api/settings - Update tenant settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN users can update settings
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = settingsSchema.parse(body)

    // Separate timezone from other settings
    const { timezone, ...settingsData } = validatedData

    // Get current settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { settings: true },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Merge with existing settings (exclude timezone since it's a separate field)
    const currentSettings = (tenant.settings as any) || {}
    const updatedSettings = {
      ...currentSettings,
      ...settingsData,
      updatedAt: new Date().toISOString(),
    }

    // Update tenant settings and timezone
    const updated = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        settings: updatedSettings,
        ...(timezone && { timezone }),
      },
      select: {
        id: true,
        name: true,
        timezone: true,
        settings: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        tenantId: updated.id,
        tenantName: updated.name,
        timezone: updated.timezone,
        settings: updated.settings || {},
      },
    })
  } catch (error: any) {
    console.error("Error updating settings:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    )
  }
}
