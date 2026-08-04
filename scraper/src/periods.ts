/**
 * Turning Screener column headers into the schema's `PeriodRef`.
 *
 * Screener labels columns by the calendar month they end in: `Mar 2026` for an
 * annual column, `Jun 2025` for a quarter. Indian financial years run
 * April→March and are named for the year they end in, so `Mar 2026` is FY26 and
 * `Jun 2025` is Q1 of FY26. Non-period columns (`TTM`, growth ranges) don't
 * match the `Mon YYYY` shape and return `null`, so callers filter them out.
 *
 * Mirrors the conventions in `src/types/period.ts` / `src/mocks/periods.ts`
 * exactly, so scraped periods key-match the ones the frontend already uses.
 */

import type { FiscalQuarter, PeriodCadence, PeriodRef } from '../../src/types/period'

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

const MONTH_LABEL: Readonly<Record<number, string>> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
}

/** Quarter that ends in a given month: Jun→Q1, Sep→Q2, Dec→Q3, Mar→Q4. */
const QUARTER_END_MONTH: Readonly<Record<number, FiscalQuarter>> = { 6: 1, 9: 2, 12: 3, 3: 4 }

function lastDayOfMonth(year: number, month: number): string {
  // Day 0 of the next month is the last day of this one.
  return String(new Date(year, month, 0).getDate()).padStart(2, '0')
}

/**
 * Parse a header like `Mar 2026` or `Jun 2025` into a `PeriodRef` at the given
 * cadence, or `null` when the header is not a period column.
 */
export function parsePeriodHeader(header: string, cadence: PeriodCadence): PeriodRef | null {
  const match = /^([A-Za-z]{3})\s+(\d{4})$/.exec(header.trim())
  if (!match) return null

  const month = MONTHS[match[1].toLowerCase()]
  const calendarYear = Number(match[2])
  if (!month || !Number.isFinite(calendarYear)) return null

  const endDate = `${calendarYear}-${String(month).padStart(2, '0')}-${lastDayOfMonth(calendarYear, month)}`

  if (cadence === 'annual') {
    const fiscalYear = calendarYear // FY named by its ending calendar year.
    const yy = String(fiscalYear).slice(-2)
    return {
      id: `FY${yy}`,
      label: `FY${yy}`,
      longLabel: `Year ended ${MONTH_LABEL[month]} ${calendarYear}`,
      cadence: 'annual',
      fiscalYear,
      quarter: null,
      endDate,
    }
  }

  const quarter = QUARTER_END_MONTH[month]
  if (!quarter) return null // A quarter must end in Mar/Jun/Sep/Dec.

  // Q1–Q3 (Jun/Sep/Dec) fall in the FY that ends the following March; Q4 (Mar)
  // ends in its own FY year.
  const fiscalYear = quarter === 4 ? calendarYear : calendarYear + 1
  const yy = String(fiscalYear).slice(-2)
  return {
    id: `FY${yy}Q${quarter}`,
    label: `Q${quarter} FY${yy}`,
    longLabel: `Quarter ended ${MONTH_LABEL[month]} ${calendarYear}`,
    cadence: 'quarterly',
    fiscalYear,
    quarter,
    endDate,
  }
}
