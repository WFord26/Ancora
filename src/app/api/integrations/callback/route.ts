import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/db"
import { exchangeQBOCode, verifyQBOState } from "@/integrations/qbo"
import { exchangeXeroCode, verifyXeroState } from "@/integrations/xero"

// GET /api/integrations/callback?provider=qbo&code=...&state=...&realmId=...
// Handles OAuth callback from accounting providers. This route is called by the
// provider after the user authorizes, so there is no session — state param encodes tenantId.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get("provider")?.toLowerCase()
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    const desc = searchParams.get("error_description") ?? error
    return NextResponse.redirect(
      `/dashboard/integrations?error=${encodeURIComponent(desc)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      "/dashboard/integrations?error=Missing+code+or+state"
    )
  }

  try {
    if (provider === "qbo") {
      const realmId = searchParams.get("realmId")
      if (!realmId) {
        return NextResponse.redirect(
          "/dashboard/integrations?error=Missing+realmId"
        )
      }

      const tenantId = verifyQBOState(state)
      if (!tenantId) {
        return NextResponse.redirect(
          "/dashboard/integrations?error=Invalid+state"
        )
      }

      const tokens = await exchangeQBOCode(code, realmId)

      await prisma.integrationConnection.upsert({
        where: {
          // Upsert by tenantId+provider using a unique constraint.
          // If no unique index exists, this falls back to create.
          id: `${tenantId}_QBO`,
        },
        update: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiry: tokens.expiry,
          config: { realmId },
          status: "ACTIVE",
        },
        create: {
          id: `${tenantId}_QBO`,
          tenantId,
          provider: "QBO",
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiry: tokens.expiry,
          config: { realmId },
          status: "ACTIVE",
        },
      })

      return NextResponse.redirect("/dashboard/integrations?success=QuickBooks+connected")
    }

    if (provider === "xero") {
      const tenantId = verifyXeroState(state)
      if (!tenantId) {
        return NextResponse.redirect(
          "/dashboard/integrations?error=Invalid+state"
        )
      }

      const tokens = await exchangeXeroCode(code)

      await prisma.integrationConnection.upsert({
        where: { id: `${tenantId}_XERO` },
        update: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiry: tokens.expiry,
          status: "ACTIVE",
        },
        create: {
          id: `${tenantId}_XERO`,
          tenantId,
          provider: "XERO",
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiry: tokens.expiry,
          status: "ACTIVE",
        },
      })

      return NextResponse.redirect("/dashboard/integrations?success=Xero+connected")
    }

    return NextResponse.redirect(
      "/dashboard/integrations?error=Unknown+provider"
    )
  } catch (err) {
    console.error("OAuth callback error:", err)
    return NextResponse.redirect(
      "/dashboard/integrations?error=Connection+failed"
    )
  }
}
