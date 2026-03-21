/**
 * Billing Cycle Queue & Worker
 * 
 * BullMQ job queue for automated monthly billing cycles.
 * 
 * Jobs:
 * - billing:cycle-all    — Scans all active retainers and closes due periods
 * - billing:cycle-single — Runs billing cycle for a single retainer
 * - billing:generate-invoice — Generates invoice for a closed period
 * 
 * The scheduler runs every 15 minutes checking for retainers whose current
 * period has ended (evaluated in each retainer's timezone). This avoids the
 * "midnight UTC" problem where different timezones would get billed on wrong days.
 */

import { Queue, Worker, type Job } from "bullmq"
import { getRedisConnection, createRedisConnection } from "@/lib/redis"
import { prisma } from "@/db"
import {
  calculateRollover,
  calculateOverage,
  decimalToNumber,
  numberToDecimal,
  type OverageTier,
  type RolloverConfig,
  type PeriodUsage,
} from "@/lib/billing"
import { generateInvoiceForPeriod } from "@/lib/invoice"
import { addMonths } from "date-fns"
import { toZonedTime } from "date-fns-tz"

// ============================================
// Queue Definition
// ============================================

const QUEUE_NAME = "billing"

let billingQueue: Queue | null = null

/**
 * Get (or create) the billing queue singleton.
 */
export function getBillingQueue(): Queue {
  if (!billingQueue) {
    billingQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000, // 5s, 25s, 125s
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    })
  }
  return billingQueue
}

// ============================================
// Job Scheduling
// ============================================

/**
 * Set up the repeating billing cycle check.
 * Runs every 15 minutes to scan for retainers with periods that need closing.
 */
export async function scheduleBillingCycleCheck(): Promise<void> {
  const queue = getBillingQueue()

  // Remove any existing repeatable job to prevent duplicates
  const existing = await queue.getRepeatableJobs()
  for (const job of existing) {
    if (job.name === "cycle-all") {
      await queue.removeRepeatableByKey(job.key)
    }
  }

  // Add new repeatable job (every 15 minutes)
  await queue.add(
    "cycle-all",
    {},
    {
      repeat: {
        pattern: "*/15 * * * *", // Every 15 minutes
      },
    }
  )

  console.log("Billing cycle check scheduled (every 15 minutes)")
}

/**
 * Manually enqueue a billing cycle for a single retainer.
 */
export async function enqueueBillingCycle(
  retainerId: string,
  tenantId: string
): Promise<string> {
  const queue = getBillingQueue()
  const job = await queue.add("cycle-single", { retainerId, tenantId })
  return job.id!
}

/**
 * Enqueue invoice generation for a closed period.
 */
export async function enqueueInvoiceGeneration(
  retainerPeriodId: string,
  tenantId: string
): Promise<string> {
  const queue = getBillingQueue()
  const job = await queue.add("generate-invoice", {
    retainerPeriodId,
    tenantId,
  })
  return job.id!
}

// ============================================
// Job Handlers
// ============================================

/**
 * Scan all active retainers for periods that need closing.
 * For each retainer, check if NOW >= period_end in the retainer's timezone.
 */
async function handleCycleAll(_job: Job): Promise<{
  processed: number
  errors: string[]
}> {
  const now = new Date()
  const errors: string[] = []
  let processed = 0

  // Find all active retainers with OPEN periods whose end date has passed
  const retainersWithDuePeriods = await prisma.retainer.findMany({
    where: {
      status: "ACTIVE",
      periods: {
        some: {
          status: "OPEN",
          periodEnd: {
            lte: now, // Period end is in the past (UTC comparison is safe here since periodEnd is already UTC)
          },
        },
      },
    },
    select: {
      id: true,
      tenantId: true,
      name: true,
    },
  })

  console.log(
    `Billing cycle check: ${retainersWithDuePeriods.length} retainers have periods due for closing`
  )

  // Enqueue individual billing cycles
  const queue = getBillingQueue()
  for (const retainer of retainersWithDuePeriods) {
    try {
      await queue.add(
        "cycle-single",
        {
          retainerId: retainer.id,
          tenantId: retainer.tenantId,
        },
        {
          jobId: `cycle-${retainer.id}-${now.toISOString().slice(0, 7)}`, // Deduplicate per month
        }
      )
      processed++
    } catch (err: any) {
      errors.push(`Failed to enqueue cycle for ${retainer.name}: ${err.message}`)
    }
  }

  return { processed, errors }
}

/**
 * Run billing cycle for a single retainer.
 * Closes current period, calculates rollover/overage, opens new period.
 */
async function handleCycleSingle(
  job: Job<{ retainerId: string; tenantId: string }>
): Promise<{
  closedPeriodId: string
  newPeriodId: string
  overageHours: number
  rolloverHoursOut: number
}> {
  const { retainerId, tenantId } = job.data

  // Fetch retainer with current open period
  const retainer = await prisma.retainer.findUnique({
    where: { id: retainerId, tenantId },
    include: {
      periods: {
        where: { status: "OPEN" },
        orderBy: { periodStart: "desc" },
        take: 1,
      },
    },
  })

  if (!retainer) {
    throw new Error(`Retainer ${retainerId} not found`)
  }

  if (retainer.status !== "ACTIVE") {
    throw new Error(`Retainer ${retainerId} is not active (status: ${retainer.status})`)
  }

  const currentPeriod = retainer.periods[0]
  if (!currentPeriod) {
    throw new Error(`No open period found for retainer ${retainerId}`)
  }

  // Verify period has actually ended
  if (currentPeriod.periodEnd > new Date()) {
    throw new Error(`Period ${currentPeriod.id} has not ended yet`)
  }

  // Calculate total used hours from time entries
  const timeEntriesSum = await prisma.timeEntry.aggregate({
    where: {
      retainerPeriodId: currentPeriod.id,
      isBillable: true,
    },
    _sum: { durationMinutes: true },
  })

  const usedMinutes = timeEntriesSum._sum.durationMinutes || 0
  const usedHours = usedMinutes / 60

  // Prepare usage data
  const usage: PeriodUsage = {
    includedHours: decimalToNumber(currentPeriod.includedHours),
    rolloverHoursIn: decimalToNumber(currentPeriod.rolloverHoursIn),
    usedHours,
  }

  // Parse overage tiers
  const overageTiers = retainer.overageTiers as OverageTier[] | null
  const flatOverageRate = retainer.overageRate
    ? decimalToNumber(retainer.overageRate)
    : decimalToNumber(retainer.ratePerHour)

  // Calculate overage
  const overageResult = calculateOverage(usage, overageTiers, flatOverageRate)

  // Prepare rollover config
  const rolloverConfig: RolloverConfig = {
    enabled: retainer.rolloverEnabled,
    capType: retainer.rolloverCapType || "PERCENTAGE",
    capValue: retainer.rolloverCapValue
      ? decimalToNumber(retainer.rolloverCapValue)
      : 0,
    expiryMonths: retainer.rolloverExpiryMonths || 3,
  }

  const periodEndInTz = toZonedTime(currentPeriod.periodEnd, retainer.timezone)
  const rolloverResult = calculateRollover(
    usage,
    rolloverConfig,
    periodEndInTz,
    retainer.timezone
  )

  // Close current period and open new one in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Close current period
    await tx.retainerPeriod.update({
      where: { id: currentPeriod.id },
      data: {
        status: "CLOSED",
        usedHours: numberToDecimal(usage.usedHours),
        overageHours: numberToDecimal(overageResult.overageHours),
        rolloverHoursOut: numberToDecimal(rolloverResult.rolloverHoursOut),
      },
    })

    // Calculate next period boundaries
    const nextPeriodStart = currentPeriod.periodEnd
    const nextPeriodEnd = addMonths(nextPeriodStart, 1)

    // Open new period
    const newPeriod = await tx.retainerPeriod.create({
      data: {
        retainerId: retainer.id,
        periodStart: nextPeriodStart,
        periodEnd: nextPeriodEnd,
        includedHours: retainer.includedHours,
        rolloverHoursIn: numberToDecimal(rolloverResult.rolloverHoursOut),
        rolloverExpiryDate: rolloverResult.expiryDate,
        usedHours: 0,
        overageHours: 0,
        rolloverHoursOut: 0,
        status: "OPEN",
      },
    })

    return { closedPeriodId: currentPeriod.id, newPeriodId: newPeriod.id }
  })

  // Enqueue invoice generation for the closed period
  const queue = getBillingQueue()
  await queue.add("generate-invoice", {
    retainerPeriodId: result.closedPeriodId,
    tenantId,
  })

  console.log(
    `Billing cycle completed for retainer ${retainer.name}: ` +
      `${usedHours.toFixed(2)}h used, ${overageResult.overageHours.toFixed(2)}h overage, ` +
      `${rolloverResult.rolloverHoursOut.toFixed(2)}h rolled over`
  )

  return {
    ...result,
    overageHours: overageResult.overageHours,
    rolloverHoursOut: rolloverResult.rolloverHoursOut,
  }
}

/**
 * Generate invoice for a closed retainer period.
 */
async function handleGenerateInvoice(
  job: Job<{ retainerPeriodId: string; tenantId: string }>
): Promise<{ invoiceId: string; invoiceNumber: string; total: number }> {
  const { retainerPeriodId, tenantId } = job.data

  const result = await generateInvoiceForPeriod(retainerPeriodId, tenantId)

  console.log(
    `Invoice ${result.invoice.invoiceNumber} generated: $${result.grandTotal.toFixed(2)}`
  )

  return {
    invoiceId: result.invoice.id,
    invoiceNumber: result.invoice.invoiceNumber,
    total: result.grandTotal,
  }
}

// ============================================
// Worker Setup
// ============================================

let billingWorker: Worker | null = null

/**
 * Start the billing worker.
 * Call this from a standalone worker process (not the Next.js server).
 */
export function startBillingWorker(): Worker {
  if (billingWorker) {
    return billingWorker
  }

  billingWorker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      console.log(`Processing billing job: ${job.name} (${job.id})`)

      switch (job.name) {
        case "cycle-all":
          return handleCycleAll(job)
        case "cycle-single":
          return handleCycleSingle(job)
        case "generate-invoice":
          return handleGenerateInvoice(job)
        default:
          throw new Error(`Unknown job type: ${job.name}`)
      }
    },
    {
      connection: createRedisConnection() as any,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000, // Max 10 jobs per second
      },
    }
  )

  billingWorker.on("completed", (job) => {
    console.log(`Billing job completed: ${job.name} (${job.id})`)
  })

  billingWorker.on("failed", (job, err) => {
    console.error(
      `Billing job failed: ${job?.name} (${job?.id}) — ${err.message}`
    )
  })

  billingWorker.on("error", (err) => {
    console.error("Billing worker error:", err)
  })

  console.log("Billing worker started")
  return billingWorker
}

/**
 * Stop the billing worker (for graceful shutdown).
 */
export async function stopBillingWorker(): Promise<void> {
  if (billingWorker) {
    await billingWorker.close()
    billingWorker = null
    console.log("Billing worker stopped")
  }
}
