import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/db"
import { getInvoicePdfData, renderInvoiceHtml } from "@/lib/invoice-pdf"

/**
 * GET /api/invoices/[id]/pdf
 * 
 * Generate and return invoice as HTML (for printing/PDF conversion)
 * 
 * Query params:
 * - format: "html" (default) or "json" (returns data only)
 * 
 * All roles can access (clients restricted to their own invoices)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const invoiceId = params.id
    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "html"

    // Verify invoice exists and belongs to tenant
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, tenantId: session.user.tenantId },
      select: { clientId: true },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      )
    }

    // Client role can only view their own invoices
    if (session.user.role === "CLIENT") {
      const clientMatch = await prisma.client.findFirst({
        where: {
          tenantId: session.user.tenantId,
          email: session.user.email,
        },
      })

      if (!clientMatch || invoice.clientId !== clientMatch.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Get invoice PDF data
    const pdfData = await getInvoicePdfData(invoiceId, session.user.tenantId)

    if (format === "json") {
      return NextResponse.json({ data: pdfData })
    }

    // Render HTML
    const html = renderInvoiceHtml(pdfData)

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${pdfData.invoiceNumber}.html"`,
      },
    })
  } catch (error: any) {
    console.error("Error generating invoice PDF:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate invoice PDF" },
      { status: 500 }
    )
  }
}
