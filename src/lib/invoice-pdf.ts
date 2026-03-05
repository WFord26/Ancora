/**
 * Invoice PDF Generation
 * 
 * Generates professional invoice PDFs as HTML, then converts to PDF.
 * Uses a simple HTML template approach for server-side generation.
 * 
 * For production, consider using:
 * - Puppeteer/Playwright for HTML→PDF conversion
 * - Or a hosted PDF API (e.g., PDFShift, HTML2PDF)
 * 
 * This module:
 * 1. Fetches invoice data from DB
 * 2. Renders HTML invoice template
 * 3. Returns HTML (can be printed to PDF via browser)
 * 4. Optionally stores PDF in Azure Blob Storage
 */

import prisma from "@/db"
import { format } from "date-fns"
import { decimalToNumber } from "./billing"

// ============================================
// Types
// ============================================

export type InvoicePdfData = {
  invoiceNumber: string
  status: string
  issuedDate: string
  dueDate: string
  paidDate?: string

  // Client details
  clientName: string
  clientEmail: string
  clientAddress?: string
  clientCity?: string
  clientState?: string
  clientZipCode?: string
  clientCountry?: string

  // Tenant/company details (from settings)
  companyName: string
  companyAddress?: string
  companyEmail?: string
  companyPhone?: string

  // Line items
  lineItems: {
    description: string
    quantity: number
    unitPrice: number
    total: number
    lineType: string
  }[]

  // Totals
  subtotal: number
  tax: number
  total: number

  // Retainer info (if applicable)
  retainerName?: string
  periodStart?: string
  periodEnd?: string
  includedHours?: number
  usedHours?: number
  overageHours?: number
}

// ============================================
// Data Fetching
// ============================================

/**
 * Fetch all data needed to generate an invoice PDF
 */
export async function getInvoicePdfData(
  invoiceId: string,
  tenantId: string
): Promise<InvoicePdfData> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      retainerPeriod: {
        include: {
          retainer: true,
        },
      },
      lineItems: {
        orderBy: { id: "asc" },
      },
      tenant: {
        select: {
          name: true,
          settings: true,
        },
      },
    },
  })

  if (!invoice) {
    throw new Error("Invoice not found")
  }

  if (invoice.tenantId !== tenantId) {
    throw new Error("Unauthorized")
  }

  // Extract tenant settings (company details)
  const settings = (invoice.tenant.settings as any) || {}

  return {
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issuedDate: format(new Date(invoice.issuedDate), "MMM d, yyyy"),
    dueDate: format(new Date(invoice.dueDate), "MMM d, yyyy"),
    paidDate: invoice.paidDate
      ? format(new Date(invoice.paidDate), "MMM d, yyyy")
      : undefined,

    clientName: invoice.client.name,
    clientEmail: invoice.client.email || "",
    clientAddress: invoice.client.address || undefined,
    clientCity: invoice.client.city || undefined,
    clientState: invoice.client.state || undefined,
    clientZipCode: invoice.client.zipCode || undefined,
    clientCountry: invoice.client.country || undefined,

    companyName: invoice.tenant.name,
    companyAddress: settings.address,
    companyEmail: settings.email,
    companyPhone: settings.phone,

    lineItems: invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: decimalToNumber(item.quantity),
      unitPrice: decimalToNumber(item.unitPrice),
      total: decimalToNumber(item.total),
      lineType: item.lineType,
    })),

    subtotal: decimalToNumber(invoice.subtotal),
    tax: decimalToNumber(invoice.tax),
    total: decimalToNumber(invoice.total),

    retainerName: invoice.retainerPeriod?.retainer?.name,
    periodStart: invoice.retainerPeriod
      ? format(new Date(invoice.retainerPeriod.periodStart), "MMM d, yyyy")
      : undefined,
    periodEnd: invoice.retainerPeriod
      ? format(new Date(invoice.retainerPeriod.periodEnd), "MMM d, yyyy")
      : undefined,
    includedHours: invoice.retainerPeriod
      ? decimalToNumber(invoice.retainerPeriod.includedHours)
      : undefined,
    usedHours: invoice.retainerPeriod
      ? decimalToNumber(invoice.retainerPeriod.usedHours)
      : undefined,
    overageHours: invoice.retainerPeriod
      ? decimalToNumber(invoice.retainerPeriod.overageHours)
      : undefined,
  }
}

// ============================================
// HTML Template
// ============================================

/**
 * Render invoice as HTML
 * Suitable for browser print-to-PDF or server-side PDF conversion
 */
export function renderInvoiceHtml(data: InvoicePdfData): string {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)

  const formatQuantity = (qty: number) =>
    qty % 1 === 0 ? qty.toString() : qty.toFixed(2)

  const lineTypeLabel = (type: string) => {
    switch (type) {
      case "RETAINER_FEE":
        return "Retainer Fee"
      case "OVERAGE":
        return "Overage"
      case "ROLLOVER_CREDIT":
        return "Rollover Credit"
      case "EXPENSE":
        return "Expense"
      case "ADJUSTMENT":
        return "Adjustment"
      default:
        return type
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "#6b7280",
      SENT: "#2563eb",
      PAID: "#16a34a",
      OVERDUE: "#dc2626",
      VOID: "#9ca3af",
    }
    const color = colors[status] || "#6b7280"
    return `<span style="background:${color};color:white;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:600;text-transform:uppercase;">${status}</span>`
  }

  const clientAddress = [
    data.clientAddress,
    [data.clientCity, data.clientState, data.clientZipCode]
      .filter(Boolean)
      .join(", "),
    data.clientCountry,
  ]
    .filter(Boolean)
    .join("<br>")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937;
      line-height: 1.6;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    .company-info h1 {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
    }
    .company-info p {
      font-size: 13px;
      color: #6b7280;
    }
    .invoice-meta {
      text-align: right;
    }
    .invoice-meta h2 {
      font-size: 28px;
      font-weight: 700;
      color: #4f46e5;
      margin-bottom: 8px;
    }
    .invoice-meta .number {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 40px;
    }
    .detail-section h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #9ca3af;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .detail-section p {
      font-size: 14px;
      color: #374151;
    }
    .detail-section .name {
      font-weight: 600;
      font-size: 16px;
      color: #111827;
    }
    .dates-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .date-item label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #9ca3af;
      font-weight: 600;
    }
    .date-item p {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
    }
    .retainer-summary {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 30px;
    }
    .retainer-summary h3 {
      font-size: 14px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 8px;
    }
    .retainer-stats {
      display: flex;
      gap: 24px;
      font-size: 13px;
      color: #3b82f6;
    }
    .retainer-stats span {
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    thead th {
      text-align: left;
      padding: 12px 16px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
    }
    thead th:last-child,
    thead th:nth-child(3),
    thead th:nth-child(4) {
      text-align: right;
    }
    tbody td {
      padding: 12px 16px;
      font-size: 14px;
      border-bottom: 1px solid #f3f4f6;
    }
    tbody td:last-child,
    tbody td:nth-child(3),
    tbody td:nth-child(4) {
      text-align: right;
    }
    tbody td .line-type {
      font-size: 11px;
      color: #9ca3af;
      display: block;
    }
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }
    .totals-table {
      width: 280px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
      color: #6b7280;
    }
    .totals-row.total {
      border-top: 2px solid #e5e7eb;
      padding-top: 12px;
      margin-top: 4px;
      font-size: 18px;
      font-weight: 700;
      color: #111827;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
    @media print {
      body { padding: 20px; }
      .header { margin-bottom: 30px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h1>${escapeHtml(data.companyName)}</h1>
      ${data.companyAddress ? `<p>${escapeHtml(data.companyAddress)}</p>` : ""}
      ${data.companyEmail ? `<p>${escapeHtml(data.companyEmail)}</p>` : ""}
      ${data.companyPhone ? `<p>${escapeHtml(data.companyPhone)}</p>` : ""}
    </div>
    <div class="invoice-meta">
      <h2>INVOICE</h2>
      <div class="number">${escapeHtml(data.invoiceNumber)}</div>
      ${statusBadge(data.status)}
    </div>
  </div>

  <div class="details-grid">
    <div class="detail-section">
      <h3>Bill To</h3>
      <p class="name">${escapeHtml(data.clientName)}</p>
      ${data.clientEmail ? `<p>${escapeHtml(data.clientEmail)}</p>` : ""}
      ${clientAddress ? `<p>${clientAddress}</p>` : ""}
    </div>
    <div class="detail-section" style="text-align:right;">
      <h3>Invoice Details</h3>
      <p><strong>Date:</strong> ${data.issuedDate}</p>
      <p><strong>Due:</strong> ${data.dueDate}</p>
      ${data.paidDate ? `<p><strong>Paid:</strong> ${data.paidDate}</p>` : ""}
    </div>
  </div>

  ${
    data.retainerName
      ? `
  <div class="retainer-summary">
    <h3>${escapeHtml(data.retainerName)}</h3>
    <div class="retainer-stats">
      ${data.periodStart && data.periodEnd ? `<div>Period: <span>${data.periodStart} – ${data.periodEnd}</span></div>` : ""}
      ${data.includedHours !== undefined ? `<div>Included: <span>${data.includedHours}h</span></div>` : ""}
      ${data.usedHours !== undefined ? `<div>Used: <span>${data.usedHours}h</span></div>` : ""}
      ${data.overageHours !== undefined && data.overageHours > 0 ? `<div>Overage: <span>${data.overageHours}h</span></div>` : ""}
    </div>
  </div>
  `
      : ""
  }

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Type</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${data.lineItems
        .map(
          (item) => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td><span class="line-type">${lineTypeLabel(item.lineType)}</span></td>
        <td>${formatQuantity(item.quantity)}</td>
        <td>${formatCurrency(item.unitPrice)}</td>
        <td>${formatCurrency(item.total)}</td>
      </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${formatCurrency(data.subtotal)}</span>
      </div>
      ${
        data.tax > 0
          ? `
      <div class="totals-row">
        <span>Tax</span>
        <span>${formatCurrency(data.tax)}</span>
      </div>
      `
          : ""
      }
      <div class="totals-row total">
        <span>Total</span>
        <span>${formatCurrency(data.total)}</span>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>Thank you for your business.</p>
    <p>${escapeHtml(data.companyName)} • ${data.invoiceNumber}</p>
  </div>
</body>
</html>`
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }
  return text.replace(/[&<>"']/g, (m) => map[m] || m)
}
