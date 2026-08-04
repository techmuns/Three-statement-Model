/**
 * Per-share metrics derived from the statements.
 *
 * Currently just book value per share, which the condensed schema *can*
 * support (unlike Net Debt/EBITDA and free cash flow, which need balance-sheet
 * cash and a capex breakout the source does not expose). Kept separate from the
 * KPI set in `kpis.ts` because it is a per-share figure, not one of the six
 * standard KPIs.
 */

import type { Reported, Rupees } from '@/types/common'
import { periodsOf } from '@/types/financials'
import { getCompanyFinancials } from './financials'

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export interface BookValuePerSharePoint {
  /** Matches `PeriodRef.id`. */
  readonly periodId: string
  /** Book value per share in ₹. `null` when a period lacks the inputs. */
  readonly value: Reported<Rupees>
}

export interface CompanyBookValuePerShare {
  readonly companyId: string
  /** Period the `latest` value is as of. Matches `PeriodRef.id`. */
  readonly asOfPeriodId: string
  /** One point per annual balance-sheet period, oldest → newest. */
  readonly series: readonly BookValuePerSharePoint[]
  /** The most recent period's value, for convenience. */
  readonly latest: Reported<Rupees>
}

/**
 * Book value per share = (equity capital + reserves) ÷ shares outstanding.
 *
 * `sharesOutstandingCrore` is the share count the scraper derives from Net
 * Profit ÷ EPS (a company that reports EPS in no year fails to scrape), so it
 * is always present and > 0 for real data and authored > 0 for mock data. The
 * one current share count is applied across every period — a per-current-share
 * book-value series — because a reliable per-period share count is not held.
 *
 * Generic over real/mock: it reads `getCompanyFinancials`, so a scraped company
 * and a mock one behave identically. `null` when no balance sheet exists.
 */
export function getBookValuePerShare(companyId: string): CompanyBookValuePerShare | null {
  const financials = getCompanyFinancials(companyId)
  if (!financials) return null

  const periods = periodsOf(financials.annual.balanceSheet)
  if (periods.length === 0) return null

  const shares = financials.sharesOutstandingCrore
  const series: BookValuePerSharePoint[] = periods.map((balanceSheet) => ({
    periodId: balanceSheet.period.id,
    value: shares > 0 ? round((balanceSheet.equityCapital + balanceSheet.reserves) / shares) : null,
  }))

  return {
    companyId,
    asOfPeriodId: periods[periods.length - 1].period.id,
    series,
    latest: series[series.length - 1].value,
  }
}
