/**
 * BullMQ Worker Entry Point
 * 
 * Run this as a standalone process to process billing cycle jobs.
 * 
 * Usage:
 *   npx tsx src/jobs/worker.ts
 * 
 * Or via npm script:
 *   npm run worker
 * 
 * Required environment variables:
 *   REDIS_URL - Redis connection URL
 *   DATABASE_URL - PostgreSQL connection URL
 * 
 * This process runs independently of the Next.js server and handles:
 * - Scheduled billing cycle checks (every 15 minutes)
 * - Individual retainer billing cycles
 * - Invoice generation for closed periods
 */

import { startBillingWorker, stopBillingWorker, scheduleBillingCycleCheck } from "./billing-cycle"
import { closeRedisConnection } from "@/lib/redis"

async function main() {
  console.log("========================================")
  console.log("  Ancora Billing Worker")
  console.log("  Starting up...")
  console.log("========================================")

  // Start the worker
  const worker = startBillingWorker()

  // Schedule the repeating billing cycle check
  await scheduleBillingCycleCheck()

  console.log("Worker is running. Press Ctrl+C to stop.")

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`)

    try {
      await stopBillingWorker()
      await closeRedisConnection()
      console.log("Worker stopped cleanly.")
      process.exit(0)
    } catch (err) {
      console.error("Error during shutdown:", err)
      process.exit(1)
    }
  }

  process.on("SIGINT", () => shutdown("SIGINT"))
  process.on("SIGTERM", () => shutdown("SIGTERM"))

  // Keep process alive
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception in worker:", err)
  })

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection in worker:", reason)
  })
}

main().catch((err) => {
  console.error("Failed to start worker:", err)
  process.exit(1)
})
