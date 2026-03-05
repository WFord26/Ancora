/**
 * Redis Connection Configuration
 * 
 * Provides a shared Redis (IORedis) connection for BullMQ queues and workers.
 * Uses REDIS_URL from environment (set in .env and docker-compose.yml).
 */

import IORedis from "ioredis"

let connection: IORedis | null = null

/**
 * Get or create a shared Redis connection.
 * Reuses the same connection across queues and workers.
 */
export function getRedisConnection(): IORedis {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    })

    connection.on("error", (err) => {
      console.error("Redis connection error:", err)
    })

    connection.on("connect", () => {
      console.log("Redis connected successfully")
    })
  }

  return connection
}

/**
 * Create a new Redis connection (for workers that need their own connection).
 * BullMQ workers should not share connections with queues.
 */
export function createRedisConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"
  const conn = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })

  conn.on("error", (err) => {
    console.error("Redis worker connection error:", err)
  })

  return conn
}

/**
 * Close the shared Redis connection (for graceful shutdown).
 */
export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit()
    connection = null
  }
}
