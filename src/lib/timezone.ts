// Utility functions for timezone handling
// See Architecture.md section 6.4 for function signatures

import { fromZonedTime } from 'date-fns-tz/fromZonedTime'
import { toZonedTime } from 'date-fns-tz/toZonedTime'
import { formatInTimeZone } from 'date-fns-tz/formatInTimeZone'
import { startOfMonth, endOfMonth, addMonths } from 'date-fns'

/**
 * Convert a "wall clock" time in a timezone to UTC for storage
 */
export function toUTC(localTime: Date, timezone: string): Date {
  return fromZonedTime(localTime, timezone)
}

/**
 * Convert UTC to a specific timezone for display
 */
export function toLocal(utcTime: Date, timezone: string): Date {
  return toZonedTime(utcTime, timezone)
}

/**
 * Get the start of a billing period in a timezone, returned as UTC
 */
export function getPeriodBoundary(
  year: number,
  month: number,
  timezone: string
): {
  startUtc: Date
  endUtc: Date
} {
  // Create a date object for the first day of the month in the given timezone
  const localStart = new Date(year, month - 1, 1) // month is 0-indexed in Date constructor
  const localEnd = startOfMonth(addMonths(localStart, 1))

  // Convert to UTC
  const startUtc = fromZonedTime(localStart, timezone)
  const endUtc = fromZonedTime(localEnd, timezone)

  return { startUtc, endUtc }
}

/**
 * Determine which RetainerPeriod a UTC timestamp falls into
 */
export function getPeriodForTimestamp(
  utcTimestamp: Date,
  retainerTimezone: string
): {
  year: number
  month: number
} {
  // Convert UTC to the retainer's timezone
  const localTime = toZonedTime(utcTimestamp, retainerTimezone)
  
  return {
    year: localTime.getFullYear(),
    month: localTime.getMonth() + 1, // Return 1-indexed month
  }
}

/**
 * Format a UTC date for display in a specific timezone
 */
export function formatForDisplay(
  utcTime: Date,
  timezone: string,
  fmt: string
): string {
  return formatInTimeZone(utcTime, timezone, fmt)
}
