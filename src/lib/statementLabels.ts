/**
 * Layout-aware row labels for the P&L.
 *
 * Screener presents a lender's P&L with different line names and different
 * arithmetic — interest is expended against revenue rather than charged below
 * operating profit. `CompanyFinancials.statementLayout` records which layout a
 * company files under; this module turns that into the labels a reader sees.
 *
 * The mapping is a lookup keyed by layout, not a set of `if (isBank)` branches
 * at the call sites. Adding another bank is therefore zero work — its dataset
 * already carries `statementLayout: 'banking'`. Adding a *new* layout (an
 * insurer, say) is one entry here plus one member of the `StatementLayout`
 * union; the exhaustiveness of `Record<StatementLayout, …>` makes the compiler
 * point at every table that has to grow.
 */

import type { StatementLayout } from '@/types/financials'

export interface ProfitLossLabels {
  sales: string
  expenses: string
  operatingProfit: string
  opmPercent: string
  otherIncome: string
  interest: string
  depreciation: string
  profitBeforeTax: string
  taxPercent: string
  netProfit: string
  eps: string
  /** Terse forms for chart titles, axes and stat tiles. */
  salesShort: string
  operatingProfitShort: string
  opmShort: string
  /** One line explaining how this layout's operating profit is arrived at. */
  operatingProfitNote: string
  /**
   * True when interest is a cost of revenue and so belongs *above* the
   * operating-profit line. Drives statement row order, so a reader can do the
   * arithmetic straight down the column.
   */
  interestAboveOperatingProfit: boolean
}

const PROFIT_LOSS_LABELS: Readonly<Record<StatementLayout, ProfitLossLabels>> = {
  standard: {
    sales: 'Sales',
    expenses: 'Expenses',
    operatingProfit: 'Operating Profit',
    opmPercent: 'OPM %',
    otherIncome: 'Other Income',
    interest: 'Interest',
    depreciation: 'Depreciation',
    profitBeforeTax: 'Profit Before Tax',
    taxPercent: 'Tax %',
    netProfit: 'Net Profit',
    eps: 'EPS',
    salesShort: 'Revenue',
    operatingProfitShort: 'Operating profit',
    opmShort: 'Operating margin',
    operatingProfitNote: 'Operating profit is sales less operating expenses.',
    interestAboveOperatingProfit: false,
  },
  banking: {
    sales: 'Interest Earned',
    expenses: 'Expenses',
    operatingProfit: 'Financing Profit',
    opmPercent: 'Financing Margin %',
    otherIncome: 'Other Income',
    interest: 'Interest Expended',
    depreciation: 'Depreciation',
    profitBeforeTax: 'Profit Before Tax',
    taxPercent: 'Tax %',
    netProfit: 'Net Profit',
    eps: 'EPS',
    salesShort: 'Interest earned',
    operatingProfitShort: 'Financing profit',
    opmShort: 'Financing margin',
    operatingProfitNote:
      'For a lender, interest expended is a cost of revenue: financing profit is interest earned less interest expended and operating expenses.',
    interestAboveOperatingProfit: true,
  },
}

export function profitLossLabels(layout: StatementLayout): ProfitLossLabels {
  return PROFIT_LOSS_LABELS[layout]
}

/** How the figures were consolidated, for a badge. */
export function basisLabel(basis: 'consolidated' | 'standalone'): string {
  return basis === 'consolidated' ? 'Consolidated' : 'Standalone'
}
