/**
 * Number formatting, Indian convention.
 *
 * `en-IN` groups digits as 2,2,3 from the right — 1,23,456 rather than
 * 123,456 — which is what Screener.in and every Indian filing use. All money in
 * this app is already in ₹ crore, so nothing here converts units.
 *
 * Every formatter takes `Reported<T>` and renders `null` as an em dash. A blank
 * or a zero would both read as "the company reported nothing", which is exactly
 * the distinction `Reported<T>` exists to preserve.
 */

import type { Reported } from '@/types/common'

/** What a not-reported figure looks like. One definition, used everywhere. */
export const NOT_REPORTED = '—'

const decimalFormatters = new Map<number, Intl.NumberFormat>()

function decimalFormatter(fractionDigits: number): Intl.NumberFormat {
  const cached = decimalFormatters.get(fractionDigits)
  if (cached) return cached

  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  decimalFormatters.set(fractionDigits, formatter)
  return formatter
}

/**
 * A ₹ crore figure: `2,48,160`.
 *
 * Negatives use a true minus sign (U+2212) rather than a hyphen, so a negative
 * cash flow does not read as a dash at small sizes.
 */
export function formatCrore(value: Reported<number>, fractionDigits = 0): string {
  if (value === null) return NOT_REPORTED
  return decimalFormatter(fractionDigits).format(value).replace('-', '−')
}

/** A percentage: `17.5%`. */
export function formatPercent(value: Reported<number>, fractionDigits = 1): string {
  if (value === null) return NOT_REPORTED
  return `${decimalFormatter(fractionDigits).format(value).replace('-', '−')}%`
}

/** A per-share figure: `₹64.71`. */
export function formatRupees(value: Reported<number>, fractionDigits = 2): string {
  if (value === null) return NOT_REPORTED
  return `₹${decimalFormatter(fractionDigits).format(value).replace('-', '−')}`
}

/**
 * Builds a ₹ crore tick formatter for one chart axis.
 *
 * Whether to switch to lakh ("10.3L crore" is how the Indian press writes 10.3
 * lakh crore) is decided once from the series maximum and then applied to every
 * tick. Deciding per tick would mix the two forms on a single axis — a scale
 * reading `1.0L, 75,000, 50,000` — which is unreadable.
 */
export function croreAxisFormatter(values: readonly number[]): (value: number) => string {
  const max = values.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0)
  const useLakh = max >= 100_000

  return (value: number) =>
    useLakh
      ? `${decimalFormatter(1)
          .format(value / 100_000)
          .replace('-', '−')}L`
      : formatCrore(value)
}

/** A signed change for a delta badge: `+6.2%`, `−1.8%`. */
export function formatSignedPercent(value: Reported<number>, fractionDigits = 1): string {
  if (value === null) return NOT_REPORTED
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatPercent(value, fractionDigits)}`
}

/**
 * A signed ₹ crore change for a delta badge: `+17,860`, `−6,220`.
 *
 * The absolute-change sibling of `formatSignedPercent`, for figures whose sign
 * makes a percentage change misleading — a cash flow line that crosses zero, or
 * an outflow that grows more negative, has no honest percentage. Delegates the
 * digit grouping to `formatCrore`, which also renders the true minus sign.
 */
export function formatSignedCrore(value: Reported<number>, fractionDigits = 0): string {
  if (value === null) return NOT_REPORTED
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatCrore(value, fractionDigits)}`
}

/** Percentage-point change, the right unit for a margin: `+40 bps`. */
export function formatBasisPoints(value: Reported<number>): string {
  if (value === null) return NOT_REPORTED
  const basisPoints = Math.round(value * 100)
  const sign = basisPoints > 0 ? '+' : basisPoints < 0 ? '−' : ''
  return `${sign}${decimalFormatter(0).format(Math.abs(basisPoints))} bps`
}

/** Period-on-period growth in percent, or `null` when it cannot be computed. */
export function percentChange(
  current: Reported<number>,
  previous: Reported<number>,
): Reported<number> {
  if (current === null || previous === null || previous === 0) return null
  return (current / previous - 1) * 100
}
