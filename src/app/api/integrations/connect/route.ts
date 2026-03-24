import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { buildOAuthUrl } from "@/integrations/qbo"
import { buildXeroOAuthUrl } from "@/integrations/xero"

const SUPPORTED_PROVIDERS = ["qbo", "xero"] as const
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number]

// GET /api/integrations/connect?provider=qbo  — redirect to OAuth provider
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const rawProvider = searchParams.get("provider")?.toLowerCase()

    if (!rawProvider || !SUPPORTED_PROVIDERS.includes(rawProvider as SupportedProvider)) {
      return NextResponse.json(
        { error: `Unsupported provider. Supported: ${SUPPORTED_PROVIDERS.join(", ")}` },
        { status: 400 }
      )
    }

    const provider = rawProvider as SupportedProvider

    let authUrl: string
    if (provider === "qbo") {
      authUrl = buildOAuthUrl(session.user.tenantId)
    } else {
      authUrl = buildXeroOAuthUrl(session.user.tenantId)
    }

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error("Error initiating OAuth:", error)
    return NextResponse.json(
      { success: false, error: "Failed to initiate OAuth flow" },
      { status: 500 }
    )
  }
}
