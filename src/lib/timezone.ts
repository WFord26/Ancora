// Utility functions for timezone handling
// See Architecture.md section 6.4 for function signatures

import { fromZonedTime } from 'date-fns-tz/fromZonedTime'
import { toZonedTime } from 'date-fns-tz/toZonedTime'
import { formatInTimeZone } from 'date-fns-tz/formatInTimeZone'
import { startOfMonth, endOfMonth, addMonths, addDays, subDays } from 'date-fns'

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

/**
 * Get the biweekly period boundaries for a given date in a timezone
 * Periods end on Sunday at 11:59 PM and are submitted by 10 AM Monday
 * 
 * @param date - Reference date (any date)
 * @param timezone - IANA timezone
 * @returns { startUtc, endUtc } - Period boundaries in UTC
 */
export function getBiweeklyPeriodBoundary(
  date: Date,
  timezone: string
): {
  startUtc: Date
  endUtc: Date
  localStart: Date
  localEnd: Date
} {
  // Convert to local timezone to find period boundaries
  const localDate = toZonedTime(date, timezone)
  
  // Find the most recent Sunday (period end) from this date
  const dayOfWeek = localDate.getDay() // 0 = Sunday, 6 = Saturday
  const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek // If today is Sunday, it's the end of current period
  
  let localEnd = new Date(localDate)
  // Move to the end of the day (11:59:59 PM)
  if (daysToSubtract === 0) {
    // Today is Sunday, make it the end of current period
    localEnd.setHours(23, 59, 59, 999)
  } else {
    // Move back to the most recent Sunday
    localEnd = subDays(localEnd, daysToSubtract)
    localEnd.setHours(23, 59, 59, 999)
  }
  
  // Start is 14 days before end (midnight Sunday → Sunday)
  let localStart = new Date(localEnd)
  localStart = subDays(localStart, 13) // 13 days back is 14-day period
  localStart.setHours(0, 0, 0, 0)
  
  // Convert back to UTC
  const startUtc = fromZonedTime(localStart, timezone)
  const endUtc = fromZonedTime(localEnd, timezone)
  
  return { startUtc, endUtc, localStart, localEnd }
}

/**
 * Get all biweekly periods starting from a start date through an end date
 * Useful for generating invoices for a date range
 */
export function getBiweeklyPeriods(
  startDate: Date,
  endDate: Date,
  timezone: string
): Array<{
  startUtc: Date
  endUtc: Date
  localStart: Date
  localEnd: Date
  periodNumber: number
}> {
  const periods = []
  let currentDate = new Date(startDate)
  let periodNumber = 1
  
  while (currentDate <= endDate) {
    const boundary = getBiweeklyPeriodBoundary(currentDate, timezone)
    periods.push({
      ...boundary,
      periodNumber,
    })
    
    // Move to next period (2 weeks later)
    currentDate = addDays(boundary.endUtc, 1)
    periodNumber++
  }
  
  return periods
}
