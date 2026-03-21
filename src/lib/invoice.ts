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

// ============================================
// Invoice Number Generation
// ============================================

/**
 * Generate next invoice number for tenant
 * Format: INV-YYYY-{sequence}
 * Example: INV-2026-00001
 */
export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  // Find highest invoice number for this year
  const lastInvoice = await prisma.invoice.findFirst({
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
 * - Retainer fee line item (monthly fee)
 * - Overage line items (if any, from PREVIOUS period - billed in arrears)
 * - Expense line items (billable expenses from this period)
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

  // Prepare line items
  const lineItems: InvoiceLineItemData[] = []

  // 1. Monthly retainer fee
  const includedHours = decimalToNumber(period.includedHours)
  const ratePerHour = decimalToNumber(retainer.ratePerHour)
  const retainerFee = includedHours * ratePerHour

  lineItems.push({
    description: `${retainer.name} - Monthly Retainer (${includedHours} hours @ $${ratePerHour}/hr)`,
    quantity: 1,
    unitPrice: retainerFee,
    total: retainerFee,
    lineType: "RETAINER_FEE",
  })

  // 2. Overage charges (from CURRENT period)
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
      description: `Overage Hours (${overageHours.toFixed(2)} hours @ $${overageRate}/hr)`,
      quantity: overageHours,
      unitPrice: overageRate,
      total: overageCost,
      lineType: "OVERAGE",
    })
  }

  // 3. Billable expenses from this period
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
      description: `Expense: ${expense.category.name} - ${expense.description}`,
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

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(tenantId)

  // Create invoice with line items in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create invoice
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

  // Prepare line items
  const lineItems: InvoiceLineItemData[] = []

  // 1. Retainer fee (based on included hours for this period)
  const includedHours = decimalToNumber(period.includedHours)
  const ratePerHour = decimalToNumber(retainer.ratePerHour)
  const retainerFee = includedHours * ratePerHour

  lineItems.push({
    description: `${retainer.name} - Retainer Fee (${includedHours} hours @ $${ratePerHour}/hr)`,
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
      description: `Expense: ${expense.category.name} - ${expense.description}`,
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

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(tenantId)

  // Create invoice with line items in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create invoice
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

  const retainer = period.retainer
  const client = retainer.client

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
      description: `Travel Time (${travelHours.toFixed(2)} hours @ $${travelRate}/hr)`,
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
      description: `Overage Hours (${overageHours.toFixed(2)} hours @ $${overageRate}/hr)`,
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
