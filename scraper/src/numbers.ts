/**
 * Parsing Screener's numeric cells into the schema's `Reported<number>`.
 *
 * Screener prints figures comma-grouped (`2,48,160` / `328,013`), percentages
 * with a trailing `%`, and negatives with a leading `-`. A genuinely blank cell
 * (or a lone dash) means "not reported" — which the schema models as `null`,
 * never `0`. This is the single place that distinction is made.
 */

import type { Reported } from '../../src/types/common'

/**
 * Parse one Screener cell. Strips grouping commas, a percent sign, and
 * whitespace; normalises the various dash glyphs to a hyphen. Returns `null`
 * for an empty or dash-only cell so a not-reported line is never read as zero.
 */
export function parseCell(raw: string): Reported<number> {
  const cleaned = raw
    .replace(/ /g, '')
    .replace(/,/g, '')
    .replace(/%/g, '')
    .replace(/[−–—]/g, '-')
    .trim()

  if (cleaned === '' || cleaned === '-') return null

  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/** Round to a fixed number of decimals, matching the mock's derivation style. */
export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
