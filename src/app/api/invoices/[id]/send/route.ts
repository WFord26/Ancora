import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendInvoice } from "@/lib/invoice"

/**
 * POST /api/invoices/[id]/send
 * 
 * Mark invoice as SENT and send email notification
 * 
 * Admin/Staff only
 * Can only send DRAFT invoices
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const invoiceId = params.id

    const invoice = await sendInvoice(invoiceId, session.user.tenantId)

    return NextResponse.json({
      success: true,
      message: "Invoice sent successfully",
      data: invoice,
    })
  } catch (error: any) {
    console.error("Error sending invoice:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send invoice" },
      { status: 500 }
    )
  }
}
