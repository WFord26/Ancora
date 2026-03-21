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
 * Export timesheet as Excel (.xlsx)
 * Note: Returns XLSX format data - requires 'xlsx' npm package
 * Install with: npm install xlsx
 */
export async function generateTimesheetExcel(data: TimesheetData): Promise<Buffer> {
  let XLSX: any
  try {
    // xlsx must be installed separately: npm install xlsx
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    XLSX = require("xlsx")
  } catch {
    throw new Error("Excel export requires the 'xlsx' package. Run: npm install xlsx")
  }

  const workbook = XLSX.utils.book_new()
  
  // Create timesheet sheet
  const timesheetData = [
    [`Timesheet - ${data.clientName} / ${data.retainerName}`],
    [`Period: ${data.periodStart} to ${data.periodEnd}`],
    [`Generated: ${data.generatedDate}`],
    [`Submission Deadline: ${data.submissionDeadline}`],
    [],
    ["SUMMARY"],
    ["Total Hours", data.totalHours.toFixed(2)],
    ["Retainer Hours", data.retainerHours.toFixed(2)],
    ["Travel Hours", data.travelHours.toFixed(2)],
    [],
    ["TIME ENTRIES"],
    [
      "Date",
      "Start Time",
      "End Time",
      "Duration",
      "Description",
      "Travel Time",
      "Invoice #",
    ],
    ...data.entries.map((entry) => [
      entry.date,
      entry.startTime,
      entry.endTime,
      entry.duration,
      entry.description,
      entry.isTravelTime ? "Yes" : "No",
      entry.invoiceNumber || "",
    ]),
  ]
  
  const worksheet = XLSX.utils.aoa_to_sheet(timesheetData)
  XLSX.utils.book_append_sheet(workbook, worksheet, "Timesheet")
  
  // Write to buffer
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" })
}

// ============================================
// PDF Export
// ============================================

/**
 * Export timesheet as PDF
 * Note: Uses your existing invoice-pdf lib pattern
 */
export async function generateTimesheetPDF(data: TimesheetData): Promise<Buffer> {
  // Use puppeteer or similar to generate PDF
  // For now, placeholder that returns a simple HTML-to-PDF conversion
  const html = generateTimesheetHTML(data)
  
  // You can integrate with puppeteer here:
  // const browser = await puppeteer.launch()
  // const page = await browser.newPage()
  // await page.setContent(html)
  // const pdf = await page.pdf()
  // await browser.close()
  // return pdf
  
  throw new Error("PDF generation requires puppeteer setup")
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
      <td>${entry.date}</td>
      <td>${entry.startTime}</td>
      <td>${entry.endTime}</td>
      <td>${entry.duration}</td>
      <td>${entry.description}</td>
      <td>${entry.isTravelTime ? "Yes" : ""}</td>
      <td>${entry.invoiceNumber || ""}</td>
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
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { font-size: 18px; margin-bottom: 10px; }
        .metadata { margin-bottom: 20px; font-size: 12px; }
        .summary { margin: 20px 0; }
        .summary-item { display: flex; justify-content: space-between; width: 300px; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
    </head>
    <body>
      <h1>Timesheet - ${data.clientName} / ${data.retainerName}</h1>
      <div class="metadata">
        <p>Period: ${data.periodStart} to ${data.periodEnd}</p>
        <p>Submission Deadline: ${data.submissionDeadline}</p>
        <p>Generated: ${data.generatedDate}</p>
      </div>
      
      <div class="summary">
        <h2 style="font-size: 14px; margin-bottom: 10px;">SUMMARY</h2>
        <div class="summary-item">
          <span>Total Hours:</span>
          <strong>${data.totalHours.toFixed(2)}</strong>
        </div>
        <div class="summary-item">
          <span>Retainer Hours:</span>
          <strong>${data.retainerHours.toFixed(2)}</strong>
        </div>
        <div class="summary-item">
          <span>Travel Hours:</span>
          <strong>${data.travelHours.toFixed(2)}</strong>
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
