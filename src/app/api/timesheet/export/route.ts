/**
 * POST /api/timesheet/export
 * 
 * Export a timesheet for a retainer period
 * Supports: PDF, CSV, Excel
 */

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { 
  collectTimesheetData,
  generateTimesheetCSV,
  generateTimesheetExcel,
  generateTimesheetPDF,
} from "@/lib/timesheet-export"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { retainerPeriodId, format = "csv" } = body

    if (!retainerPeriodId) {
      return NextResponse.json(
        { error: "retainerPeriodId required" },
        { status: 400 }
      )
    }

    if (!["csv", "pdf", "excel"].includes(format)) {
      return NextResponse.json(
        { error: "format must be csv, pdf, or excel" },
        { status: 400 }
      )
    }

    // Collect timesheet data
    const timesheetData = await collectTimesheetData(
      retainerPeriodId,
      session.user.tenantId,
      session.user.timezone
    )

    let content: string | Buffer
    let contentType: string
    let filename: string

    if (format === "csv") {
      content = generateTimesheetCSV(timesheetData)
      contentType = "text/csv"
      filename = `timesheet-${timesheetData.clientName}-${timesheetData.periodStart}.csv`
    } else if (format === "pdf") {
      content = await generateTimesheetPDF(timesheetData)
      contentType = "application/pdf"
      filename = `timesheet-${timesheetData.clientName}-${timesheetData.periodStart}.pdf`
    } else {
      content = await generateTimesheetExcel(timesheetData)
      contentType = "application/vnd.ms-excel"
      filename = `timesheet-${timesheetData.clientName}-${timesheetData.periodStart}.xls`
    }

    return new NextResponse(typeof content === "string" ? content : Buffer.from(content), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error("Timesheet export error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to export timesheet" },
      { status: 500 }
    )
  }
}
