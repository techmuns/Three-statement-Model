/**
 * Turning one or more parsed BSE segment tables into the frontend's
 * `SegmentMix` shape.
 *
 * SEBI's quarterly-results format lists the three quarter columns in a fixed
 * order — current quarter, preceding quarter, year-ago quarter — so each
 * filing yields three quarters of segment revenue whatever quarter it reports.
 * Column dates are derived from the filing's subject quarter-end (read cleanly
 * from page 1) rather than the noisier in-table headers, then mapped to period
 * ids through the same `parsePeriodHeader` the Screener scraper uses, so ids
 * key-match the P&L periods exactly.
 *
 * Several filings are merged by period id (each covers three quarters, so two
 * consecutive results statements cover a full five-quarter window). A period's
 * share is that segment's revenue over the filing's own "Gross Value of Sales
 * and Services" total, so shares sum to 100 within the period.
 */

import type { RevenueSegment, SegmentRevenue } from '../../../src/types/financials'
import type { PeriodRef } from '../../../src/types/period'
import { parsePeriodHeader } from '../periods'
import type { SegmentTable } from './segments'

const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface PeriodData {
  readonly periodRef: PeriodRef
  readonly gross: number
  readonly revenueByName: ReadonlyMap<string, number>
}

export interface SegmentMixBuild {
  readonly segments: readonly RevenueSegment[]
  /** Target periods segment data was found for, oldest → newest. */
  readonly coveredPeriodIds: readonly string[]
  /** Target periods with no data in the supplied filings (each earlier filing
   * added covers three more quarters). */
  readonly missingPeriodIds: readonly string[]
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** (year, month) of the current, preceding and year-ago quarter columns. */
function quarterColumns(quarterEndISO: string): { year: number; month: number }[] {
  const [year, month] = quarterEndISO.split('-').map(Number)
  const precMonth = month - 3
  return [
    { year, month },
    precMonth <= 0 ? { year: year - 1, month: precMonth + 12 } : { year, month: precMonth },
    { year: year - 1, month },
  ]
}

/** Index every filing's three quarter columns by period id. */
function indexPeriods(tables: readonly SegmentTable[]): Map<string, PeriodData> {
  const byPeriod = new Map<string, PeriodData>()
  for (const table of tables) {
    quarterColumns(table.quarterEndISO).forEach((col, columnIndex) => {
      const ref = parsePeriodHeader(`${MONTH_ABBR[col.month]} ${col.year}`, 'quarterly')
      if (!ref || byPeriod.has(ref.id)) return
      const revenueByName = new Map(table.segments.map((s) => [s.name, s.revenueByColumn[columnIndex]]))
      byPeriod.set(ref.id, { periodRef: ref, gross: table.grossByColumn[columnIndex], revenueByName })
    })
  }
  return byPeriod
}

/**
 * Build `RevenueSegment[]` for whichever of `targetPeriodIds` (the statement
 * set's own periods, oldest → newest) the supplied filings actually cover.
 *
 * Each segment carries an entry only for covered periods — never a fabricated or
 * zero-filled value for a period we have no filing for — and the caller is told
 * which periods are still missing so coverage stays honest.
 */
export function buildSegmentMix(
  tables: readonly SegmentTable[],
  targetPeriodIds: readonly string[],
): SegmentMixBuild {
  const byPeriod = indexPeriods(tables)
  const coveredPeriodIds = targetPeriodIds.filter((id) => byPeriod.has(id))
  const missingPeriodIds = targetPeriodIds.filter((id) => !byPeriod.has(id))

  // Canonical segment identity/order from the most-recent filing.
  const canonical = tables[0].segments.map((s) => ({ id: slug(s.name), name: s.name }))

  const segments: RevenueSegment[] = canonical.map((seg) => {
    const values: SegmentRevenue[] = coveredPeriodIds.map((id) => {
      const data = byPeriod.get(id)!
      const revenue = data.revenueByName.get(seg.name) ?? 0
      const sharePercent = data.gross > 0 ? Number(((revenue / data.gross) * 100).toFixed(2)) : 0
      return { periodId: id, revenue, sharePercent }
    })
    return { id: seg.id, name: seg.name, values }
  })

  return { segments, coveredPeriodIds, missingPeriodIds }
}
