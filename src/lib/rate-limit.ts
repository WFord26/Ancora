/**
 * Redis-backed sliding-window rate limiter (Node.js runtime only).
 *
 * Uses a Redis sorted set per key. Each request is recorded as a member with
 * score = timestamp (ms). The set is trimmed to the current window before
 * counting, so stale entries are pruned automatically.
 *
 * Usage:
 *   const result = await rateLimit(`login:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 })
 *   if (!result.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })
 */

import { getRedisConnection } from "@/lib/redis"

export type RateLimitResult = {
  success: boolean
  /** Calls remaining in the current window */
  remaining: number
  /** Epoch ms when the oldest entry falls out of the window (reset time) */
  resetAt: number
  /** Total limit for the window */
  limit: number
}

export type RateLimitOptions = {
  /** Maximum number of allowed requests in the window */
  limit: number
  /** Window size in milliseconds */
  windowMs: number
}

/**
 * Check and record a rate-limit entry for the given key.
 *
 * @param identifier  Unique key, e.g. `login:1.2.3.4` or `api:tenantId`
 * @param options     `limit` and `windowMs`
 */
export async function rateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { limit, windowMs } = options
  const redis = getRedisConnection()
  const now = Date.now()
  const windowStart = now - windowMs
  const key = `rl:${identifier}`
  const member = `${now}:${Math.random().toString(36).slice(2)}`

  // Atomic pipeline: remove stale entries, add current, count, set TTL
  const pipeline = redis.pipeline()
  pipeline.zremrangebyscore(key, "-inf", windowStart)
  pipeline.zadd(key, now, member)
  pipeline.zcard(key)
  pipeline.pexpire(key, windowMs)

  const results = await pipeline.exec()

  // zcard result is at index 2
  const count = (results?.[2]?.[1] as number) ?? 1
  const success = count <= limit
  const remaining = Math.max(0, limit - count)

  // Oldest entry in the set determines when the window resets
  const oldest = await redis.zrange(key, 0, 0, "WITHSCORES")
  const resetAt = oldest.length >= 2 ? parseInt(oldest[1]) + windowMs : now + windowMs

  return { success, remaining, resetAt, limit }
}

/**
 * Pre-configured limiters for common use cases.
 */
export const Limiters = {
  /** Login: 5 attempts per 15 minutes per IP */
  login: (ip: string) =>
    rateLimit(`login:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 }),

  /** General API: 200 requests per hour per tenant */
  api: (tenantId: string) =>
    rateLimit(`api:${tenantId}`, { limit: 200, windowMs: 60 * 60 * 1000 }),

  /** Time entries: 100 writes per hour per tenant */
  timeEntries: (tenantId: string) =>
    rateLimit(`time_entries:${tenantId}`, { limit: 100, windowMs: 60 * 60 * 1000 }),

  /** Invoice generation: 50 per hour per tenant */
  invoices: (tenantId: string) =>
    rateLimit(`invoices:${tenantId}`, { limit: 50, windowMs: 60 * 60 * 1000 }),
} as const

/**
 * Helper: build standard rate-limit response headers.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "Retry-After": result.success ? "" : String(Math.ceil((result.resetAt - Date.now()) / 1000)),
  }
}

/**
 * Extract the best available IP from a NextRequest/Request headers.
 */
export function getIp(request: Request | { headers: { get(key: string): string | null } }): string {
  const headers = request.headers
  const forwarded =
    (typeof headers.get === "function" ? headers.get("x-forwarded-for") : null) ??
    (headers as any)["x-forwarded-for"] ??
    ""
  const first = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : ""
  return first || "unknown"
}
