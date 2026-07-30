/**
 * The reporting periods every mock dataset is keyed to.
 *
 * Anchored to a July 2026 "today": the most recent reported quarter is Q1 FY27
 * (ended June 2026) and the most recent completed year is FY26 (ended March
 * 2026). All series run oldest → newest.
 *
 * Real periods arrive with the scraper and are derived from the column headers
 * Screener returns; this file is replaced then.
 */

import type { FiscalQuarter, PeriodRef } from '@/types/period'

const MONTH_ENDING_QUARTER: Readonly<Record<FiscalQuarter, string>> = {
  1: 'Jun',
  2: 'Sep',
  3: 'Dec',
  4: 'Mar',
}

function quarterPeriod(fiscalYear: number, quarter: FiscalQuarter): PeriodRef {
  // Q1–Q3 end inside the previous calendar year; Q4 ends in the FY's own year.
  const calendarYear = quarter === 4 ? fiscalYear : fiscalYear - 1
  const endDate = {
    1: `${calendarYear}-06-30`,
    2: `${calendarYear}-09-30`,
    3: `${calendarYear}-12-31`,
    4: `${calendarYear}-03-31`,
  }[quarter]
  const shortYear = String(fiscalYear).slice(-2)

  return {
    id: `FY${shortYear}Q${quarter}`,
    label: `Q${quarter} FY${shortYear}`,
    longLabel: `Quarter ended ${MONTH_ENDING_QUARTER[quarter]} ${calendarYear}`,
    cadence: 'quarterly',
    fiscalYear,
    quarter,
    endDate,
  }
}

function annualPeriod(fiscalYear: number): PeriodRef {
  const shortYear = String(fiscalYear).slice(-2)

  return {
    id: `FY${shortYear}`,
    label: `FY${shortYear}`,
    longLabel: `Year ended Mar ${fiscalYear}`,
    cadence: 'annual',
    fiscalYear,
    quarter: null,
    endDate: `${fiscalYear}-03-31`,
  }
}

/** Last 5 quarters, oldest → newest: Q1 FY26 … Q1 FY27. */
export const QUARTERLY_PERIODS: readonly PeriodRef[] = [
  quarterPeriod(2026, 1),
  quarterPeriod(2026, 2),
  quarterPeriod(2026, 3),
  quarterPeriod(2026, 4),
  quarterPeriod(2027, 1),
]

/** Last 5 financial years, oldest → newest: FY22 … FY26. */
export const ANNUAL_PERIODS: readonly PeriodRef[] = [
  annualPeriod(2022),
  annualPeriod(2023),
  annualPeriod(2024),
  annualPeriod(2025),
  annualPeriod(2026),
]

/**
 * The four quarters of FY26, in the order they appear in `QUARTERLY_PERIODS`.
 * Quarterly figures for these sum exactly to the FY26 annual column, as they
 * do in a real filing.
 */
export const FY26_QUARTER_COUNT = 4

export const LATEST_QUARTER = QUARTERLY_PERIODS[QUARTERLY_PERIODS.length - 1]
export const LATEST_ANNUAL_PERIOD = ANNUAL_PERIODS[ANNUAL_PERIODS.length - 1]
