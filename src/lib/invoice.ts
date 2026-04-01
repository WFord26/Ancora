/**
 * Invoice Generation Utilities
 * 
 * Functions for creating invoices from retainer periods,
 * including line items for fees, overage, and expenses.
 */

import { prisma } from "@/db"
import { Prisma } from "@prisma/client"
import { addDays, format } from "date-fns"
import { sendInvoiceNotification } from "@/lib/email"
import { decimalToNumber, numberToDecimal, type OverageResult } from "./billing"

// ============================================
// Types
// ============================================

export type InvoiceLineItemData = {
  description: string
  quantity: number
  unitPrice: number
  total: number
  lineType: "RETAINER_FEE" | "OVERAGE" | "ROLLOVER_CREDIT" | "EXPENSE" | "ADJUSTMENT"
  expenseId?: string
}

export type InvoiceGenerationResult = {
  invoice: any
  lineItems: InvoiceLineItemData[]
  totalBeforeTax: number
  tax: number
  grandTotal: number
}

export type ClosedPeriodInvoiceResult = {
  primaryInvoice: InvoiceGenerationResult
  deferredInvoice: InvoiceGenerationResult | null
}

type InvoiceDbClient = Prisma.TransactionClient | typeof prisma

type InvoicePeriodLike = {
  id: string
  retainerId: string
  periodStart: Date
  periodEnd: Date
  includedHours: Prisma.Decimal
}

function formatPeriodRange(period: Pick<InvoicePeriodLike, "periodStart" | "periodEnd">): string {
  return `${format(new Date(period.periodStart), "MMM d, yyyy")} - ${format(
    new Date(period.periodEnd),
    "MMM d, yyyy"
  )}`
}

function buildRetainerFeeDescription(
  retainerName: string,
  billingCycle: "MONTHLY" | "BIWEEKLY",
  periodLabel: string,
  includedHours: number,
  ratePerHour: number
): string {
  const feeLabel =
    billingCycle === "BIWEEKLY" ? "Retainer Fee" : "Monthly Retainer"

  return `${retainerName} - ${feeLabel} for ${periodLabel} (${includedHours} hours @ $${ratePerHour}/hr)`
}

async function resolveInvoicePeriodForRetainerFee(
  closedPeriod: InvoicePeriodLike & {
    retainer: {
      billingTiming: "PREPAID" | "POSTPAID"
    }
  }
): Promise<InvoicePeriodLike> {
  if (closedPeriod.retainer.billingTiming !== "PREPAID") {
    return {
      id: closedPeriod.id,
      retainerId: closedPeriod.retainerId,
      periodStart: closedPeriod.periodStart,
      periodEnd: closedPeriod.periodEnd,
      includedHours: closedPeriod.includedHours,
    }
  }

  const nextOpenPeriod = await prisma.retainerPeriod.findFirst({
    where: {
      retainerId: closedPeriod.retainerId,
      status: "OPEN",
      periodStart: {
        gte: closedPeriod.periodEnd,
      },
    },
    orderBy: { periodStart: "asc" },
  })

  if (!nextOpenPeriod) {
    throw new Error("No upcoming open period found for prepaid retainer")
  }

  return nextOpenPeriod
}

async function assertNoPrimaryInvoiceForPeriod(
  db: InvoiceDbClient,
  tenantId: string,
  retainerPeriodId: string
): Promise<void> {
  const existingInvoice = await db.invoice.findFirst({
    where: {
      tenantId,
      retainerPeriodId,
      lineItems: {
        some: {
          lineType: "RETAINER_FEE",
        },
      },
    },
    select: {
      invoiceNumber: true,
    },
  })

  if (existingInvoice) {
    throw new Error(
      `A retainer fee invoice already exists for this period (${existingInvoice.invoiceNumber})`
    )
  }
}

// ============================================
// Invoice Number Generation
// ============================================

/**
 * Generate next invoice number for tenant
 * Format: INV-YYYY-{sequence}
 * Example: INV-2026-00001
 */
export async function generateInvoiceNumber(
  tenantId: string,
  db: InvoiceDbClient = prisma
): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  // Find highest invoice number for this year
  const lastInvoice = await db.invoice.findFirst({
    where: {
      tenantId,
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNumber: "desc",
    },
  })

  let sequence = 1
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split("-")[2] || "0")
    sequence = lastSequence + 1
  }

  return `${prefix}${sequence.toString().padStart(5, "0")}`
}

// ============================================
// Invoice Generation
// ============================================

/**
 * Generate invoice for a closed retainer period
 * 
 * Creates:
 * - Retainer fee line item for the billed service period
 * - Overage line items (if any) from the closed usage period
 * - Expense line items from the closed usage period
 * - Invoice record with totals
 * 
 * @param retainerPeriodId - ID of the CLOSED period
 * @param tenantId - Tenant ID for authorization
 * @param dueInDays - Days until invoice is due (default 30)
 */
export async function generateInvoiceForPeriod(
  retainerPeriodId: string,
  tenantId: string,
  dueInDays: number = 30
): Promise<InvoiceGenerationResult> {
  // Fetch period with retainer and client details
  const period = await prisma.retainerPeriod.findUnique({
    where: { id: retainerPeriodId },
    include: {
      retainer: {
        include: {
          client: true,
        },
      },
    },
  })

  if (!period) {
    throw new Error("Retainer period not found")
  }

  if (period.retainer.tenantId !== tenantId) {
    throw new Error("Unauthorized")
  }

  if (period.status !== "CLOSED") {
    throw new Error("Can only generate invoice for closed period")
  }

  const retainer = period.retainer
  const client = retainer.client
  const billedPeriod = await resolveInvoicePeriodForRetainerFee(period)
  const billedPeriodLabel = formatPeriodRange(billedPeriod)
  const closedPeriodLabel = formatPeriodRange(period)

  // Prepare line items
  const lineItems: InvoiceLineItemData[] = []

  // 1. Retainer fee for the billed service period
  const includedHours = decimalToNumber(billedPeriod.includedHours)
  const ratePerHour = decimalToNumber(retainer.ratePerHour)
  const retainerFee = includedHours * ratePerHour

  lineItems.push({
    description: buildRetainerFeeDescription(
      retainer.name,
      retainer.billingCycle,
      billedPeriodLabel,
      includedHours,
      ratePerHour
    ),
    quantity: 1,
    unitPrice: retainerFee,
    total: retainerFee,
    lineType: "RETAINER_FEE",
  })

  // 2. Overage charges from the closed usage period
  const overageHours = decimalToNumber(period.overageHours)
  if (overageHours > 0) {
    // Calculate overage cost
    // Note: In production, you'd want to store the tier breakdown from billing cycle
    // For now, use simple calculation with overage rate
    const overageRate = retainer.overageRate 
      ? decimalToNumber(retainer.overageRate)
      : ratePerHour

    const overageCost = overageHours * overageRate

    lineItems.push({
      description: `Overage Hours for ${closedPeriodLabel} (${overageHours.toFixed(2)} hours @ $${overageRate}/hr)`,
      quantity: overageHours,
      unitPrice: overageRate,
      total: overageCost,
      lineType: "OVERAGE",
    })
  }

  // 3. Billable expenses from the closed usage period
  const expenses = await prisma.expense.findMany({
    where: {
      clientId: client.id,
      status: "APPROVED",
      isBillable: true,
      invoiceId: null, // Not yet invoiced
      expenseDate: {
        gte: period.periodStart,
        lte: period.periodEnd,
      },
    },
    include: {
      category: true,
    },
  })

  for (const expense of expenses) {
    const amount = decimalToNumber(expense.amount)
    lineItems.push({
      description: `Expense for ${closedPeriodLabel}: ${expense.category.name} - ${expense.description}`,
      quantity: 1,
      unitPrice: amount,
      total: amount,
      lineType: "EXPENSE",
      expenseId: expense.id,
    })
  }

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const tax = 0 // No tax for now
  const total = subtotal + tax

  // Create invoice with line items in a transaction
  const result = await prisma.$transaction(async (tx) => {
    await assertNoPrimaryInvoiceForPeriod(tx, tenantId, billedPeriod.id)
    const invoiceNumber = await generateInvoiceNumber(tenantId, tx)

    // Create invoice
    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        clientId: client.id,
        retainerPeriodId: billedPeriod.id,
        invoiceNumber,
        status: "DRAFT",
        issuedDate: new Date(),
        dueDate: addDays(new Date(), dueInDays),
        subtotal: numberToDecimal(subtotal),
        tax: numberToDecimal(tax),
        total: numberToDecimal(total),
      },
    })

    // Create line items
    const createdLineItems = await Promise.all(
      lineItems.map((item) =>
        tx.invoiceLineItem.create({
          data: {
            invoiceId: invoice.id,
            description: item.description,
            quantity: numberToDecimal(item.quantity),
            unitPrice: numberToDecimal(item.unitPrice),
            total: numberToDecimal(item.total),
            lineType: item.lineType,
            expenseId: item.expenseId,
          },
        })
      )
    )

    // Mark expenses as invoiced
    if (expenses.length > 0) {
      await tx.expense.updateMany({
        where: {
          id: { in: expenses.map((e) => e.id) },
        },
        data: {
          invoiceId: invoice.id,
        },
      })
    }

    // Mark period as billed
    await tx.retainerPeriod.update({
      where: { id: period.id },
      data: { status: "BILLED" },
    })

    return { invoice, lineItems: createdLineItems }
  })

  return {
    invoice: result.invoice,
    lineItems,
    totalBeforeTax: subtotal,
    tax,
    grandTotal: total,
  }
}

/**
 * Generate the initial prepaid invoice for an open retainer period.
 *
 * This is used when a newly created prepaid retainer should invoice the
 * current service period immediately instead of waiting for the first cycle
 * close.
 */
export async function generatePrepaidInvoiceForCurrentPeriod(
  retainerPeriodId: string,
  tenantId: string,
  dueInDays?: number
): Promise<InvoiceGenerationResult> {
  const period = await prisma.retainerPeriod.findUnique({
    where: { id: retainerPeriodId },
    include: {
      retainer: {
        include: {
          client: true,
        },
      },
    },
  })

  if (!period) {
    throw new Error("Retainer period not found")
  }

  if (period.retainer.tenantId !== tenantId) {
    throw new Error("Unauthorized")
  }

  if (period.status !== "OPEN") {
    throw new Error("Can only generate an initial prepaid invoice for an open period")
  }

  if (period.retainer.billingTiming !== "PREPAID") {
    throw new Error("Retainer is not configured for prepaid billing")
  }

  const retainer = period.retainer
  const client = retainer.client
  const periodLabel = formatPeriodRange(period)
  const includedHours = decimalToNumber(period.includedHours)
  const ratePerHour = decimalToNumber(retainer.ratePerHour)
  const retainerFee = includedHours * ratePerHour
  const lineItems: InvoiceLineItemData[] = [
    {
      description: buildRetainerFeeDescription(
        retainer.name,
        retainer.billingCycle,
        periodLabel,
        includedHours,
        ratePerHour
      ),
      quantity: 1,
      unitPrice: retainerFee,
      total: retainerFee,
      lineType: "RETAINER_FEE",
    },
  ]
  const subtotal = retainerFee
  const tax = 0
  const total = subtotal + tax
  const defaultDueInDays = retainer.billingCycle === "BIWEEKLY" ? 14 : 30

  const result = await prisma.$transaction(async (tx) => {
    await assertNoPrimaryInvoiceForPeriod(tx, tenantId, period.id)
    const invoiceNumber = await generateInvoiceNumber(tenantId, tx)

    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        clientId: client.id,
        retainerPeriodId: period.id,
        invoiceNumber,
        status: "DRAFT",
        issuedDate: new Date(),
        dueDate: addDays(new Date(), dueInDays ?? defaultDueInDays),
        subtotal: numberToDecimal(subtotal),
        tax: numberToDecimal(tax),
        total: numberToDecimal(total),
      },
    })

    const createdLineItems = await Promise.all(
      lineItems.map((item) =>
        tx.invoiceLineItem.create({
          data: {
            invoiceId: invoice.id,
            description: item.description,
            quantity: numberToDecimal(item.quantity),
            unitPrice: numberToDecimal(item.unitPrice),
            total: numberToDecimal(item.total),
            lineType: item.lineType,
          },
        })
      )
    )

    return { invoice, lineItems: createdLineItems }
  })

  return {
    invoice: result.invoice,
    lineItems,
    totalBeforeTax: subtotal,
    tax,
    grandTotal: total,
  }
}

/**
 * Send invoice (mark as SENT and optionally send email)
 * 
 * @param invoiceId - Invoice identifier
 * @param tenantId - Tenant ID for authorization
 */
export async function sendInvoice(
  invoiceId: string,
  tenantId: string
): Promise<any> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      lineItems: true,
    },
  })

  if (!invoice) {
    throw new Error("Invoice not found")
  }

  if (invoice.tenantId !== tenantId) {
    throw new Error("Unauthorized")
  }

  if (invoice.status !== "DRAFT") {
    throw new Error("Only draft invoices can be sent")
  }

  // Update invoice status
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "SENT",
      issuedDate: new Date(), // Update issued date to send date
    },
    include: {
      client: true,
      lineItems: true,
    },
  })

  // Send email notification to client
  const clientEmail = updatedInvoice.client.billingEmail || updatedInvoice.client.email
  if (clientEmail) {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    try {
      await sendInvoiceNotification({
        to: clientEmail,
        clientName: updatedInvoice.client.companyName,
        invoiceNumber: updatedInvoice.invoiceNumber,
        amount: Number(updatedInvoice.total),
        dueDate: format(new Date(updatedInvoice.dueDate), "MMMM d, yyyy"),
        portalUrl: `${baseUrl}/portal/invoices/${updatedInvoice.id}`,
      })
    } catch (emailError) {
      console.error("Failed to send invoice email:", emailError)
      // Don't throw — invoice was already marked as sent
    }
  }

  return updatedInvoice
}

/**
 * Mark invoice as paid
 * 
 * @param invoiceId - Invoice identifier
 * @param tenantId - Tenant ID for authorization
 * @param paidDate - Date payment received
 */
export async function markInvoicePaid(
  invoiceId: string,
  tenantId: string,
  paidDate: Date = new Date()
): Promise<any> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  })

  if (!invoice) {
    throw new Error("Invoice not found")
  }

  if (invoice.tenantId !== tenantId) {
    throw new Error("Unauthorized")
  }

  return await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "PAID",
      paidDate,
    },
    include: {
      client: true,
      lineItems: true,
    },
  })
}

export async function generateInvoicesForClosedPeriod(
  retainerPeriodId: string,
  tenantId: string,
  options?: {
    monthlyDueInDays?: number
    biweeklyDueInDays?: number
    deferredDueInDays?: number
  }
): Promise<ClosedPeriodInvoiceResult> {
  const period = await prisma.retainerPeriod.findUnique({
    where: { id: retainerPeriodId },
    include: {
      retainer: {
        select: {
          id: true,
          tenantId: true,
          billingCycle: true,
        },
      },
    },
  })

  if (!period) {
    throw new Error("Retainer period not found")
  }

  if (period.retainer.tenantId !== tenantId) {
    throw new Error("Unauthorized")
  }

  if (period.retainer.billingCycle === "BIWEEKLY") {
    const primaryInvoice = await generateBiweeklyInvoiceForPeriod(
      retainerPeriodId,
      tenantId,
      options?.biweeklyDueInDays ?? 14
    )

    const previousBilledPeriod = await prisma.retainerPeriod.findFirst({
      where: {
        retainerId: period.retainer.id,
        status: "BILLED",
        periodStart: {
          lt: period.periodStart,
        },
      },
      orderBy: { periodStart: "desc" },
    })

    const deferredInvoice = previousBilledPeriod
      ? await generateOverageInvoiceForPreviousPeriod(
          previousBilledPeriod.id,
          tenantId,
          options?.deferredDueInDays ?? 30
        )
      : null

    return { primaryInvoice, deferredInvoice }
  }

  const primaryInvoice = await generateInvoiceForPeriod(
    retainerPeriodId,
    tenantId,
    options?.monthlyDueInDays ?? 30
  )

  return {
    primaryInvoice,
    deferredInvoice: null,
  }
}

// ============================================
// Biweekly Invoice Generation (NEW)
// ============================================

/**
 * Generate invoice for a biweekly period
 * 
 * This function:
 * 1. Links retainer hours to current invoice
 * 2. Separates travel time and overages for next invoice
 * 3. Creates line items for retainer fee, expenses
 * 4. Travel/overage charges deferred to next period's invoice
 */
export async function generateBiweeklyInvoiceForPeriod(
  retainerPeriodId: string,
  tenantId: string,
  dueInDays: number = 14
): Promise<InvoiceGenerationResult> {
  const period = await prisma.retainerPeriod.findUnique({
    where: { id: retainerPeriodId },
    include: {
      retainer: {
        include: {
          client: true,
        },
      },
      timeEntries: {
        where: { isBillable: true },
      },
    },
  })

  if (!period) {
    throw new Error("Retainer period not found")
  }

  if (period.retainer.tenantId !== tenantId) {
    throw new Error("Unauthorized")
  }

  if (period.status !== "CLOSED") {
    throw new Error("Can only generate invoice for closed period")
  }

  const retainer = period.retainer
  const client = retainer.client
  const billedPeriod = await resolveInvoicePeriodForRetainerFee(period)
  const billedPeriodLabel = formatPeriodRange(billedPeriod)
  const closedPeriodLabel = formatPeriodRange(period)

  // Prepare line items
  const lineItems: InvoiceLineItemData[] = []

  // 1. Retainer fee for the billed service period
  const includedHours = decimalToNumber(billedPeriod.includedHours)
  const ratePerHour = decimalToNumber(retainer.ratePerHour)
  const retainerFee = includedHours * ratePerHour

  lineItems.push({
    description: buildRetainerFeeDescription(
      retainer.name,
      retainer.billingCycle,
      billedPeriodLabel,
      includedHours,
      ratePerHour
    ),
    quantity: 1,
    unitPrice: retainerFee,
    total: retainerFee,
    lineType: "RETAINER_FEE",
  })

  // 2. Link time entries (non-travel) to this invoice
  const nonTravelEntries = period.timeEntries.filter(
    (e) => !e.isTravelTime && e.isBillable
  )
  const travelEntries = period.timeEntries.filter((e) => e.isTravelTime)

  // 3. Billable expenses (only non-travel expenses included in current invoice)
  const expenses = await prisma.expense.findMany({
    where: {
      clientId: client.id,
      status: "APPROVED",
      isBillable: true,
      invoiceId: null,
      expenseDate: {
        gte: period.periodStart,
        lte: period.periodEnd,
      },
    },
    include: {
      category: true,
    },
  })

  for (const expense of expenses) {
    const amount = decimalToNumber(expense.amount)
    lineItems.push({
      description: `Expense for ${closedPeriodLabel}: ${expense.category.name} - ${expense.description}`,
      quantity: 1,
      unitPrice: amount,
      total: amount,
      lineType: "EXPENSE",
      expenseId: expense.id,
    })
  }

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const tax = 0 // No tax for now
  const total = subtotal + tax

  // Create invoice with line items in a transaction
  const result = await prisma.$transaction(async (tx) => {
    await assertNoPrimaryInvoiceForPeriod(tx, tenantId, billedPeriod.id)
    const invoiceNumber = await generateInvoiceNumber(tenantId, tx)

    // Create invoice
    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        clientId: client.id,
        retainerPeriodId: billedPeriod.id,
        invoiceNumber,
        status: "DRAFT",
        issuedDate: new Date(),
        dueDate: addDays(new Date(), dueInDays),
        subtotal: numberToDecimal(subtotal),
        tax: numberToDecimal(tax),
        total: numberToDecimal(total),
      },
    })

    // Create line items
    const createdLineItems = await Promise.all(
      lineItems.map((item) =>
        tx.invoiceLineItem.create({
          data: {
            invoiceId: invoice.id,
            description: item.description,
            quantity: numberToDecimal(item.quantity),
            unitPrice: numberToDecimal(item.unitPrice),
            total: numberToDecimal(item.total),
            lineType: item.lineType,
            expenseId: item.expenseId,
          },
        })
      )
    )

    // Link non-travel time entries to this invoice
    if (nonTravelEntries.length > 0) {
      await tx.timeEntry.updateMany({
        where: {
          id: { in: nonTravelEntries.map((e) => e.id) },
        },
        data: {
          invoiceId: invoice.id,
        },
      })
    }

    // Travel entries and overage will be handled in next cycle
    // (they stay unlinked for now, will be assigned to next invoice)

    // Mark expenses as invoiced
    if (expenses.length > 0) {
      await tx.expense.updateMany({
        where: {
          id: { in: expenses.map((e) => e.id) },
        },
        data: {
          invoiceId: invoice.id,
        },
      })
    }

    // Mark period as billed
    await tx.retainerPeriod.update({
      where: { id: period.id },
      data: { status: "BILLED" },
    })

    return { invoice, lineItems: createdLineItems }
  })

  return {
    invoice: result.invoice,
    lineItems: lineItems,
    totalBeforeTax: subtotal,
    tax,
    grandTotal: total,
  }
}

/**
 * Generate invoice for travel and overage charges from PREVIOUS period
 * This creates a separate line item invoice for deferred charges
 */
export async function generateOverageInvoiceForPreviousPeriod(
  retainerPeriodId: string,
  tenantId: string,
  dueInDays: number = 30
): Promise<InvoiceGenerationResult | null> {
  const period = await prisma.retainerPeriod.findUnique({
    where: { id: retainerPeriodId },
    include: {
      retainer: {
        include: {
          client: true,
        },
      },
      timeEntries: {
        where: { isBillable: true, invoiceId: null },
      },
    },
  })

  if (!period) {
    throw new Error("Retainer period not found")
  }

  if (period.retainer.tenantId !== tenantId) {
    throw new Error("Unauthorized")
  }

  const existingOverageInvoice = await prisma.invoice.findFirst({
    where: {
      tenantId,
      retainerPeriodId: period.id,
      lineItems: {
        some: { lineType: "OVERAGE" },
        none: {
          lineType: {
            in: ["RETAINER_FEE", "EXPENSE", "ROLLOVER_CREDIT", "ADJUSTMENT"],
          },
        },
      },
    },
    include: {
      lineItems: true,
    },
  })

  if (existingOverageInvoice) {
    return null
  }

  const retainer = period.retainer
  const client = retainer.client
  const closedPeriodLabel = formatPeriodRange(period)

  // Get travel and overage entries from this period that weren't invoiced yet
  const travelEntries = period.timeEntries.filter((e) => e.isTravelTime)

  // If no travel/overage to invoice, return null
  if (travelEntries.length === 0 && decimalToNumber(period.overageHours) === 0) {
    return null
  }

  const lineItems: InvoiceLineItemData[] = []

  // Add travel time charge
  if (travelEntries.length > 0) {
    const travelHours = travelEntries.reduce((sum, e) => sum + e.durationMinutes / 60, 0)
    const travelRate = retainer.travelTimeRate
      ? decimalToNumber(retainer.travelTimeRate)
      : decimalToNumber(retainer.ratePerHour)

    const travelCost = travelHours * travelRate

    lineItems.push({
      description: `Travel Time for ${closedPeriodLabel} (${travelHours.toFixed(2)} hours @ $${travelRate}/hr)`,
      quantity: travelHours,
      unitPrice: travelRate,
      total: travelCost,
      lineType: "OVERAGE",
    })
  }

  // Add overage hours charge
  const overageHours = decimalToNumber(period.overageHours)
  if (overageHours > 0) {
    const overageRate = retainer.overageRate
      ? decimalToNumber(retainer.overageRate)
      : decimalToNumber(retainer.ratePerHour)

    const overageCost = overageHours * overageRate

    lineItems.push({
      description: `Overage Hours for ${closedPeriodLabel} (${overageHours.toFixed(2)} hours @ $${overageRate}/hr)`,
      quantity: overageHours,
      unitPrice: overageRate,
      total: overageCost,
      lineType: "OVERAGE",
    })
  }

  if (lineItems.length === 0) {
    return null
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const tax = 0
  const total = subtotal + tax
  const invoiceNumber = await generateInvoiceNumber(tenantId)

  // Create separate overage invoice
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        clientId: client.id,
        retainerPeriodId: period.id,
        invoiceNumber,
        status: "DRAFT",
        issuedDate: new Date(),
        dueDate: addDays(new Date(), dueInDays),
        subtotal: numberToDecimal(subtotal),
        tax: numberToDecimal(tax),
        total: numberToDecimal(total),
      },
    })

    // Create line items
    const createdLineItems = await Promise.all(
      lineItems.map((item) =>
        tx.invoiceLineItem.create({
          data: {
            invoiceId: invoice.id,
            description: item.description,
            quantity: numberToDecimal(item.quantity),
            unitPrice: numberToDecimal(item.unitPrice),
            total: numberToDecimal(item.total),
            lineType: item.lineType,
          },
        })
      )
    )

    // Link travel entries to this overage invoice
    if (travelEntries.length > 0) {
      await tx.timeEntry.updateMany({
        where: {
          id: { in: travelEntries.map((e) => e.id) },
        },
        data: {
          invoiceId: invoice.id,
        },
      })
    }

    return { invoice, lineItems: createdLineItems }
  })

  return {
    invoice: result.invoice,
    lineItems: lineItems,
    totalBeforeTax: subtotal,
    tax,
    grandTotal: total,
  }
}
