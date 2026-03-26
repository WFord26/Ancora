/**
 * Timesheet Export Utilities
 * 
 * Generates timesheets in multiple formats (PDF, CSV, Excel)
 * Called when biweekly periods close or on-demand by staff
 */

import { prisma } from "@/db"
import { formatInTimeZone } from "date-fns-tz"
import { format } from "date-fns"

// ============================================
// Types
// ============================================

export type TimeEntryData = {
  date: string
  startTime: string
  endTime: string
  duration: string
  description: string
  isTravelTime: boolean
  isInvoiced: boolean
  invoiceNumber?: string
}

export type TimesheetData = {
  clientName: string
  retainerName: string
  periodStart: string
  periodEnd: string
  submissionDeadline: string
  totalHours: number
  travelHours: number
  retainerHours: number
  entries: TimeEntryData[]
  generatedDate: string
}

// ============================================
// CSV Export
// ============================================

/**
 * Export timesheet as CSV
 */
export function generateTimesheetCSV(data: TimesheetData): string {
  const lines: string[] = []
  
  // Header with metadata
  lines.push(`Timesheet - ${data.clientName} / ${data.retainerName}`)
  lines.push(`Period: ${data.periodStart} to ${data.periodEnd}`)
  lines.push(`Generated: ${data.generatedDate}`)
  lines.push(`Submission Deadline: ${data.submissionDeadline}`)
  lines.push("")
  
  // Summary
  lines.push("SUMMARY")
  lines.push(`Total Hours,${data.totalHours.toFixed(2)}`)
  lines.push(`Retainer Hours,${data.retainerHours.toFixed(2)}`)
  lines.push(`Travel Hours,${data.travelHours.toFixed(2)}`)
  lines.push("")
  
  // Detail header
  lines.push("TIME ENTRIES")
  lines.push(
    "Date,Start Time,End Time,Duration,Description,Travel Time,Invoice #"
  )
  
  // Detail rows
  for (const entry of data.entries) {
    const travelFlag = entry.isTravelTime ? "Yes" : "No"
    const invoiceNum = entry.invoiceNumber || ""
    lines.push(
      `${entry.date},${entry.startTime},${entry.endTime},${entry.duration},"${entry.description}",${travelFlag},${invoiceNum}`
    )
  }
  
  return lines.join("\n")
}

// ============================================
// Excel Export
// ============================================

/**
 * Export timesheet as an Excel-readable workbook (.xls)
 * Uses SpreadsheetML XML so it opens directly in Excel without extra packages.
 */
export async function generateTimesheetExcel(data: TimesheetData): Promise<Buffer> {
  const rows: string[] = []

  const addRow = (
    cells: Array<{ value: string; type?: "String" | "Number"; styleId?: string }>
  ) => {
    rows.push(
      `<Row>${cells
        .map(({ value, type = "String", styleId }) => {
          const style = styleId ? ` ss:StyleID="${styleId}"` : ""
          const cellValue =
            type === "Number" ? escapeXml(value) : escapeXml(value)
          return `<Cell${style}><Data ss:Type="${type}">${cellValue}</Data></Cell>`
        })
        .join("")}</Row>`
    )
  }

  addRow([{ value: `Timesheet - ${data.clientName} / ${data.retainerName}`, styleId: "title" }])
  addRow([{ value: `Period: ${data.periodStart} to ${data.periodEnd}` }])
  addRow([{ value: `Generated: ${data.generatedDate}` }])
  addRow([{ value: `Submission Deadline: ${data.submissionDeadline}` }])
  addRow([{ value: "" }])
  addRow([{ value: "SUMMARY", styleId: "section" }])
  addRow([{ value: "Total Hours" }, { value: data.totalHours.toFixed(2), type: "Number" }])
  addRow([{ value: "Retainer Hours" }, { value: data.retainerHours.toFixed(2), type: "Number" }])
  addRow([{ value: "Travel Hours" }, { value: data.travelHours.toFixed(2), type: "Number" }])
  addRow([{ value: "" }])
  addRow([{ value: "TIME ENTRIES", styleId: "section" }])
  addRow([
    { value: "Date", styleId: "header" },
    { value: "Start Time", styleId: "header" },
    { value: "End Time", styleId: "header" },
    { value: "Duration", styleId: "header" },
    { value: "Description", styleId: "header" },
    { value: "Travel Time", styleId: "header" },
    { value: "Invoice #", styleId: "header" },
  ])

  for (const entry of data.entries) {
    addRow([
      { value: entry.date },
      { value: entry.startTime },
      { value: entry.endTime },
      { value: entry.duration, type: "Number" },
      { value: entry.description },
      { value: entry.isTravelTime ? "Yes" : "No" },
      { value: entry.invoiceNumber || "" },
    ])
  }

  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Bottom"/>
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
    <Style ss:ID="title">
      <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1"/>
    </Style>
    <Style ss:ID="section">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
      <Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="header">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
      <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Timesheet">
    <Table>
      <Column ss:Width="75"/>
      <Column ss:Width="70"/>
      <Column ss:Width="70"/>
      <Column ss:Width="65"/>
      <Column ss:Width="320"/>
      <Column ss:Width="80"/>
      <Column ss:Width="90"/>
      ${rows.join("")}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <PageSetup>
        <Layout x:Orientation="Landscape"/>
      </PageSetup>
      <Selected/>
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>11</SplitHorizontal>
      <TopRowBottomPane>11</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`

  return Buffer.from(workbook, "utf8")
}

// ============================================
// PDF Export
// ============================================

/**
 * Export timesheet as PDF
 * Uses a lightweight built-in PDF writer so the export works without external tooling.
 */
export async function generateTimesheetPDF(data: TimesheetData): Promise<Buffer> {
  const lines: string[] = [
    `Timesheet - ${data.clientName} / ${data.retainerName}`,
    `Period: ${data.periodStart} to ${data.periodEnd}`,
    `Submission Deadline: ${data.submissionDeadline}`,
    `Generated: ${data.generatedDate}`,
    "",
    "SUMMARY",
    `Total Hours: ${data.totalHours.toFixed(2)}`,
    `Retainer Hours: ${data.retainerHours.toFixed(2)}`,
    `Travel Hours: ${data.travelHours.toFixed(2)}`,
    "",
    "TIME ENTRIES",
    "Date       Start  End    Hours  Travel  Invoice #    Description",
    "--------------------------------------------------------------------------",
  ]

  for (const entry of data.entries) {
    const prefix = [
      entry.date.padEnd(10, " "),
      entry.startTime.padEnd(6, " "),
      entry.endTime.padEnd(6, " "),
      entry.duration.padStart(5, " "),
      (entry.isTravelTime ? "Yes" : "No").padEnd(7, " "),
      (entry.invoiceNumber || "-").padEnd(12, " "),
    ].join("  ")

    const wrappedDescription = wrapTextForPdf(entry.description, 38)
    wrappedDescription.forEach((segment, index) => {
      lines.push(index === 0 ? `${prefix}${segment}` : `${" ".repeat(prefix.length)}${segment}`)
    })
  }

  return buildSimplePdf(lines)
}

/**
 * Generate HTML representation of timesheet
 * Can be used for PDF rendering via puppeteer
 */
export function generateTimesheetHTML(data: TimesheetData): string {
  const entryRows = data.entries
    .map(
      (entry) => `
    <tr>
      <td>${escapeHtml(entry.date)}</td>
      <td>${escapeHtml(entry.startTime)}</td>
      <td>${escapeHtml(entry.endTime)}</td>
      <td>${escapeHtml(entry.duration)}</td>
      <td>${escapeHtml(entry.description)}</td>
      <td>${entry.isTravelTime ? "Yes" : ""}</td>
      <td>${escapeHtml(entry.invoiceNumber || "")}</td>
    </tr>
  `
    )
    .join("")
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Timesheet</title>
      <style>
        @page { size: Letter landscape; margin: 24px; }
        body { font-family: Arial, sans-serif; margin: 0; color: #111827; }
        h1 { font-size: 18px; margin-bottom: 10px; }
        .metadata { margin-bottom: 20px; font-size: 12px; }
        .summary { margin: 20px 0; display: flex; gap: 24px; flex-wrap: wrap; }
        .summary-item { min-width: 160px; }
        .summary-label { display: block; color: #6b7280; font-size: 11px; }
        .summary-value { font-size: 18px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .mono { font-family: "Courier New", monospace; }
      </style>
    </head>
    <body>
      <h1>Timesheet - ${escapeHtml(data.clientName)} / ${escapeHtml(data.retainerName)}</h1>
      <div class="metadata">
        <p>Period: ${escapeHtml(data.periodStart)} to ${escapeHtml(data.periodEnd)}</p>
        <p>Submission Deadline: ${escapeHtml(data.submissionDeadline)}</p>
        <p>Generated: ${escapeHtml(data.generatedDate)}</p>
      </div>
      
      <div class="summary">
        <div class="summary-item">
          <span class="summary-label">Total Hours</span>
          <strong class="summary-value">${data.totalHours.toFixed(2)}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">Retainer Hours</span>
          <strong class="summary-value">${data.retainerHours.toFixed(2)}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">Travel Hours</span>
          <strong class="summary-value">${data.travelHours.toFixed(2)}</strong>
        </div>
      </div>
      
      <h2 style="font-size: 14px; margin-top: 30px; margin-bottom: 10px;">TIME ENTRIES</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Duration</th>
            <th>Description</th>
            <th>Travel</th>
            <th>Invoice #</th>
          </tr>
        </thead>
        <tbody>
          ${entryRows}
        </tbody>
      </table>
    </body>
    </html>
  `
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeXml(value: string): string {
  return escapeHtml(value)
}

function wrapTextForPdf(text: string, maxLength: number): string[] {
  const normalized = sanitizePdfText(text).replace(/\s+/g, " ").trim()
  if (!normalized) return [""]

  const words = normalized.split(" ")
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (candidate.length <= maxLength) {
      currentLine = candidate
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    if (word.length <= maxLength) {
      currentLine = word
      continue
    }

    let remaining = word
    while (remaining.length > maxLength) {
      lines.push(remaining.slice(0, maxLength))
      remaining = remaining.slice(maxLength)
    }
    currentLine = remaining
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function sanitizePdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\s+/g, " ")
    .trim()
}

function escapePdfText(value: string): string {
  return sanitizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
}

function buildSimplePdf(lines: string[]): Buffer {
  const pageWidth = 612
  const pageHeight = 792
  const marginX = 40
  const marginTop = 40
  const fontSize = 10
  const lineHeight = 13
  const usableHeight = pageHeight - marginTop * 2
  const linesPerPage = Math.max(1, Math.floor(usableHeight / lineHeight))
  const pages: string[][] = []

  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage))
  }

  const objects: string[] = []
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>"
  objects[2] = ""
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"

  const pageRefs: string[] = []

  for (const pageLines of pages) {
    const pageObjectId = objects.length
    const contentObjectId = pageObjectId + 1
    const startY = pageHeight - marginTop - fontSize
    const content = [
      "BT",
      `/F1 ${fontSize} Tf`,
      `${lineHeight} TL`,
      `${marginX} ${startY} Td`,
      ...pageLines.map((line, index) =>
        index === 0 ? `(${escapePdfText(line)}) Tj` : `T* (${escapePdfText(line)}) Tj`
      ),
      "ET",
    ].join("\n")

    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    objects[contentObjectId] =
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`
    pageRefs.push(`${pageObjectId} 0 R`)
  }

  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`

  let pdf = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n"
  const offsets: number[] = [0]

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, "utf8")
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8")
  pdf += `xref\n0 ${objects.length}\n`
  pdf += "0000000000 65535 f \n"

  for (let i = 1; i < objects.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return Buffer.from(pdf, "utf8")
}

// ============================================
// Timesheet Data Collection
// ============================================

/**
 * Collect timesheet data for a retainer period
 */
export async function collectTimesheetData(
  retainerPeriodId: string,
  tenantId: string,
  timezone: string
): Promise<TimesheetData> {
  // Fetch period with related data
  const period = await prisma.retainerPeriod.findUnique({
    where: { id: retainerPeriodId },
    include: {
      retainer: {
        include: {
          client: true,
        },
      },
      timeEntries: {
        where: { tenantId, isBillable: true },
        include: {
          invoice: true,
        },
        orderBy: { startTime: "asc" },
      },
    },
  })
  
  if (!period) {
    throw new Error("Retainer period not found")
  }
  
  if (period.retainer.tenantId !== tenantId) {
    throw new Error("Unauthorized")
  }
  
  const client = period.retainer.client
  const retainer = period.retainer
  
  // Calculate submission deadline (Monday 10 AM after period end)
  const periodEndDate = new Date(period.periodEnd)
  const daysUntilMonday = (8 - periodEndDate.getDay()) % 7 // Days until next Monday
  const submissionDeadline = new Date(periodEndDate)
  submissionDeadline.setDate(submissionDeadline.getDate() + daysUntilMonday)
  submissionDeadline.setHours(10, 0, 0, 0)
  
  // Process entries
  const entries: TimeEntryData[] = []
  let totalHours = 0
  let travelHours = 0
  let retainerHours = 0
  
  for (const entry of period.timeEntries) {
    const durationHours = entry.durationMinutes / 60
    totalHours += durationHours
    
    const entryDate = formatInTimeZone(entry.startTime, timezone, "yyyy-MM-dd")
    const startTime = formatInTimeZone(entry.startTime, timezone, "HH:mm")
    const endTime = formatInTimeZone(entry.endTime, timezone, "HH:mm")
    
    if (entry.isTravelTime) {
      travelHours += durationHours
    } else {
      retainerHours += durationHours
    }
    
    entries.push({
      date: entryDate,
      startTime,
      endTime,
      duration: durationHours.toFixed(2),
      description: entry.externalDescription,
      isTravelTime: entry.isTravelTime,
      isInvoiced: !!entry.invoiceId,
      invoiceNumber: entry.invoice?.invoiceNumber,
    })
  }
  
  return {
    clientName: client.companyName,
    retainerName: retainer.name,
    periodStart: formatInTimeZone(period.periodStart, timezone, "yyyy-MM-dd"),
    periodEnd: formatInTimeZone(period.periodEnd, timezone, "yyyy-MM-dd"),
    submissionDeadline: format(submissionDeadline, "yyyy-MM-dd HH:mm"),
    totalHours,
    travelHours,
    retainerHours,
    entries,
    generatedDate: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
  }
}
