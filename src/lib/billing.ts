/**
 * Billing Engine Utilities
 * 
 * Core business logic for retainer billing cycles:
 * - Rollover calculation with caps and expiration
 * - Overage tier calculation
 * - Period boundary calculations
 */

import { Decimal } from '@prisma/client/runtime/library'
import { addMonths, addDays } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'

// ============================================
// Types
// ============================================

export type OverageTier = {
  from: number        // Starting hour (inclusive)
  to: number | null   // Ending hour (exclusive), null = uncapped
  rate: number        // Rate per hour for this tier
}

export type RolloverConfig = {
  enabled: boolean
  capType: 'PERCENTAGE' | 'FIXED'
  capValue: number      // Percentage (e.g., 50 for 50%) or fixed hours
  expiryMonths: number  // How many months before rollover expires
}

export type PeriodUsage = {
  includedHours: number
  rolloverHoursIn: number
  usedHours: number
}

export type RolloverResult = {
  rolloverHoursOut: number  // Hours rolling to next period
  expiryDate: Date          // When these rollover hours expire
  expiredHours: number      // Hours that expired this period
}

export type OverageResult = {
  overageHours: number
  overageCost: number
  tierBreakdown: Array<{
    tier: number
    hours: number
    rate: number
    cost: number
  }>
}

// ============================================
// Rollover Calculation Engine
// ============================================

/**
 * Calculate rollover hours for the next period
 * 
 * Business Rules:
 * 1. Rollover = (included + rollover_in) - used
 * 2. Apply cap: PERCENTAGE of included hours OR FIXED hours
 * 3. Cannot roll over negative hours (if overage)
 * 4. Set expiry date based on expiryMonths
 * 
 * @param usage - Current period usage statistics
 * @param config - Rollover configuration from retainer
 * @param periodEnd - End date of current period (in retainer timezone)
 * @param timezone - Retainer timezone (IANA)
 * @returns Rollover calculation result
 */
export function calculateRollover(
  usage: PeriodUsage,
  config: RolloverConfig,
  periodEnd: Date,
  timezone: string
): RolloverResult {
  // If rollover not enabled, nothing rolls over
  if (!config.enabled) {
    return {
      rolloverHoursOut: 0,
      expiryDate: periodEnd,
      expiredHours: 0,
    }
  }

  // Calculate remaining hours
  const totalAvailable = usage.includedHours + usage.rolloverHoursIn
  const remaining = totalAvailable - usage.usedHours

  // Can't roll over negative hours (overage situation)
  if (remaining <= 0) {
    return {
      rolloverHoursOut: 0,
      expiryDate: periodEnd,
      expiredHours: usage.rolloverHoursIn, // All rollover hours expired unused
    }
  }

  // Apply rollover cap
  let cappedRollover = remaining

  if (config.capType === 'PERCENTAGE') {
    const maxRollover = (usage.includedHours * config.capValue) / 100
    cappedRollover = Math.min(remaining, maxRollover)
  } else if (config.capType === 'FIXED') {
    cappedRollover = Math.min(remaining, config.capValue)
  }

  // Round to 2 decimal places
  cappedRollover = Math.round(cappedRollover * 100) / 100

  // Calculate expiry date (N months from period end, in retainer timezone)
  const expiryDate = addMonths(periodEnd, config.expiryMonths)

  // Calculate how many rollover hours expired (didn't get used or rolled over)
  const expiredHours = Math.max(0, remaining - cappedRollover)

  return {
    rolloverHoursOut: cappedRollover,
    expiryDate,
    expiredHours: Math.round(expiredHours * 100) / 100,
  }
}

/**
 * Check if rollover hours have expired
 * 
 * @param expiryDate - Rollover expiry date (DATE field from DB)
 * @param currentDate - Current date to check against (in retainer timezone)
 * @returns True if expired
 */
export function isRolloverExpired(expiryDate: Date, currentDate: Date): boolean {
  return currentDate > expiryDate
}

// ============================================
// Overage Tier Calculation Engine
// ============================================

/**
 * Calculate overage cost using tiered rates
 * 
 * Business Rules:
 * 1. Overage = used - (included + rollover_in)
 * 2. If no overage, return zero
 * 3. If tiers defined, apply progressive rates
 * 4. If no tiers, use flat overageRate
 * 
 * Example with 12 overage hours:
 *   Tier 1: 0-5 hrs @ $150 = $750
 *   Tier 2: 5-10 hrs @ $175 = $875
 *   Tier 3: 10+ hrs @ $200 = $400
 *   Total: $2,025
 * 
 * @param usage - Current period usage statistics
 * @param tiers - Overage tier configuration (can be null/empty)
 * @param flatRate - Flat overage rate if no tiers
 * @returns Overage calculation result
 */
export function calculateOverage(
  usage: PeriodUsage,
  tiers: OverageTier[] | null,
  flatRate: number
): OverageResult {
  const totalAvailable = usage.includedHours + usage.rolloverHoursIn
  const overageHours = Math.max(0, usage.usedHours - totalAvailable)

  // No overage
  if (overageHours <= 0) {
    return {
      overageHours: 0,
      overageCost: 0,
      tierBreakdown: [],
    }
  }

  // Round overage hours to 2 decimals
  const roundedOverage = Math.round(overageHours * 100) / 100

  // If no tiers, use flat rate
  if (!tiers || tiers.length === 0) {
    return {
      overageHours: roundedOverage,
      overageCost: Math.round(roundedOverage * flatRate * 100) / 100,
      tierBreakdown: [
        {
          tier: 1,
          hours: roundedOverage,
          rate: flatRate,
          cost: Math.round(roundedOverage * flatRate * 100) / 100,
        },
      ],
    }
  }

  // Calculate with tiered rates
  let remainingHours = overageHours
  let totalCost = 0
  const breakdown: OverageResult['tierBreakdown'] = []

  // Sort tiers by 'from' to ensure correct order
  const sortedTiers = [...tiers].sort((a, b) => a.from - b.from)

  for (let i = 0; i < sortedTiers.length; i++) {
    const tier = sortedTiers[i]
    
    // Determine hours in this tier
    let hoursInTier = 0
    
    if (tier.to === null) {
      // Uncapped tier - all remaining hours
      hoursInTier = remainingHours
    } else {
      // Calculate tier range
      const tierRange = tier.to - tier.from
      hoursInTier = Math.min(remainingHours, tierRange)
    }

    if (hoursInTier > 0) {
      const tierCost = hoursInTier * tier.rate
      totalCost += tierCost

      breakdown.push({
        tier: i + 1,
        hours: Math.round(hoursInTier * 100) / 100,
        rate: tier.rate,
        cost: Math.round(tierCost * 100) / 100,
      })

      remainingHours -= hoursInTier
    }

    // If no more hours to allocate, stop
    if (remainingHours <= 0) break
  }

  return {
    overageHours: roundedOverage,
    overageCost: Math.round(totalCost * 100) / 100,
    tierBreakdown: breakdown,
  }
}

// ============================================
// Period Boundary Helpers
// ============================================

/**
 * Calculate the start and end dates for a billing period
 * 
 * @param retainerStartDate - When retainer started
 * @param billingDay - Day of month for billing (1-28)
 * @param timezone - Retainer timezone
 * @returns Period boundaries in UTC
 */
export function calculatePeriodBoundaries(
  retainerStartDate: Date,
  billingDay: number,
  timezone: string
): { periodStart: Date; periodEnd: Date } {
  // Get current date in retainer timezone
  const now = new Date()
  
  // Calculate the current billing period start
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  
  // Create date at billing day in retainer timezone
  const periodStartLocal = new Date(currentYear, currentMonth, billingDay)
  
  // If we're before the billing day this month, use last month
  if (now.getDate() < billingDay) {
    periodStartLocal.setMonth(periodStartLocal.getMonth() - 1)
  }
  
  // Convert to UTC
  const periodStart = fromZonedTime(periodStartLocal, timezone)
  
  // Calculate period end (same day next month)
  const periodEndLocal = new Date(periodStartLocal)
  periodEndLocal.setMonth(periodEndLocal.getMonth() + 1)
  
  const periodEnd = fromZonedTime(periodEndLocal, timezone)
  
  return { periodStart, periodEnd }
}

/**
 * Convert Prisma Decimal to number for calculations
 */
export function decimalToNumber(decimal: Decimal | number): number {
  if (typeof decimal === 'number') return decimal
  return parseFloat(decimal.toString())
}

/**
 * Convert number to Prisma Decimal for database storage
 */
export function numberToDecimal(value: number): Decimal {
  return new Decimal(value)
}
