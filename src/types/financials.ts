/**
 * A company's full financial dataset, modelled on Screener.in's statement
 * tables so the scraper phase is a field-for-field mapping rather than a
 * reshape.
 *
 * Three structural facts about the source drive the design:
 *
 * 1. Screener publishes a **condensed** statement — roughly a dozen summary
 *    lines per statement, not a full schedule. The schema matches that, so we
 *    never model a line we cannot populate.
 * 2. Quarterly P&L is reliably available; quarterly **balance sheet and cash
 *    flow generally are not**, because SEBI LODR requires them only
 *    half-yearly and Screener exposes annual columns alone. Every statement is
 *    therefore wrapped in `Availability`, per cadence.
 * 3. Banks and NBFCs get a **different P&L layout** on Screener. Rather than
 *    fork the schema, one shape carries both and `statementLayout` says which
 *    identity holds. See `StatementLayout`.
 */

import type { Availability, Crore, DataSource, Percent, Reported, Rupees } from './common'
import type { PeriodCadence, PeriodRef } from './period'

/* -------------------------------------------------------------------------- */
/* P&L                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Which Screener P&L layout a company's statements follow. The field names in
 * `ProfitLossPeriod` are the same either way; what changes is how
 * `operatingProfit` and `profitBeforeTax` are derived, because for a lender
 * interest is a cost of revenue rather than a financing charge.
 *
 * - `standard` — Screener's "Sales / Expenses / Operating Profit / OPM %" table.
 *   `operatingProfit = sales − expenses`
 *   `profitBeforeTax = operatingProfit + otherIncome − interest − depreciation`
 *
 * - `banking` — Screener's "Revenue / Interest / Expenses / Financing Profit /
 *   Financing Margin %" table used for banks and NBFCs. `sales` holds Revenue
 *   (interest earned), `interest` holds interest *expended*, and
 *   `operatingProfit`/`opmPercent` hold Financing Profit and Financing Margin %.
 *   `operatingProfit = sales − expenses − interest`
 *   `profitBeforeTax = operatingProfit + otherIncome − depreciation`
 */
export type StatementLayout = 'standard' | 'banking'

export interface ProfitLossPeriod {
  readonly period: PeriodRef
  /** Screener "Sales" (non-financials) or "Revenue" (banking layout). */
  readonly sales: Crore
  /** Operating expenses. Excludes interest and depreciation in both layouts. */
  readonly expenses: Crore
  /** Screener "Operating Profit", or "Financing Profit" on the banking layout. */
  readonly operatingProfit: Crore
  /** Screener "OPM %", or "Financing Margin %" on the banking layout. */
  readonly opmPercent: Percent
  readonly otherIncome: Crore
  /** Finance cost; interest *expended* on the banking layout. */
  readonly interest: Crore
  /** Blank on Screener for some lenders — hence nullable. */
  readonly depreciation: Reported<Crore>
  readonly profitBeforeTax: Crore
  /** Effective tax rate as reported, not the statutory rate. Can be negative
   * in a period with a write-back. */
  readonly taxPercent: Percent
  /** Profit after tax, attributable to the reporting entity. */
  readonly netProfit: Crore
  /**
   * Basic EPS in ₹ per share. Screener leaves this blank on some consolidated
   * quarters, so it is nullable rather than derived on the fly.
   */
  readonly eps: Reported<Rupees>
}

/* -------------------------------------------------------------------------- */
/* Segment revenue mix                                                        */
/* -------------------------------------------------------------------------- */

/** One segment's revenue in one period. Joined to periods by `periodId`. */
export interface SegmentRevenue {
  /** Matches `PeriodRef.id` of a period in the same `StatementSet`. */
  readonly periodId: string
  readonly revenue: Crore
  /** Share of that period's total sales. Shares across segments sum to 100. */
  readonly sharePercent: Percent
}

export interface RevenueSegment {
  readonly id: string
  /** As the company names it in its segment disclosure, e.g. "O2C". */
  readonly name: string
  /** One entry per period in the parent set, oldest → newest. */
  readonly values: readonly SegmentRevenue[]
}

/**
 * Segment disclosure is a separate filing from the summary P&L and is not
 * scraped from the same table, so it carries its own availability.
 */
export type SegmentMix = Availability<{ readonly segments: readonly RevenueSegment[] }>

/* -------------------------------------------------------------------------- */
/* Balance sheet                                                              */
/* -------------------------------------------------------------------------- */

/** Screener's condensed balance sheet: four liability lines, four asset lines. */
export interface BalanceSheetPeriod {
  readonly period: PeriodRef
  /** Paid-up share capital at face value — not market capitalisation. */
  readonly equityCapital: Crore
  readonly reserves: Crore
  /** Total debt, short and long term combined, as Screener presents it. */
  readonly borrowings: Crore
  readonly otherLiabilities: Crore
  /** Equals `totalAssets` by construction. */
  readonly totalLiabilities: Crore
  /** Net block of tangible and intangible fixed assets. */
  readonly fixedAssets: Crore
  /** Capital work in progress. Blank on Screener for most lenders. */
  readonly cwip: Reported<Crore>
  readonly investments: Crore
  readonly otherAssets: Crore
  readonly totalAssets: Crore
}

/* -------------------------------------------------------------------------- */
/* Cash flow                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Screener's summary cash flow shows only the three activity totals and the
 * net movement. The working-capital breakout below it comes from the expanded
 * view and is not always present, so those three lines are nullable while the
 * activity totals are not.
 */
export interface CashFlowPeriod {
  readonly period: PeriodRef
  /** Cash generated before working-capital movement and tax. */
  readonly operatingProfitBeforeWorkingCapital: Reported<Crore>
  /** Negative when working capital absorbed cash. */
  readonly workingCapitalChange: Reported<Crore>
  /** Reported as an outflow, so normally negative. */
  readonly taxPaid: Reported<Crore>
  /** Screener "Cash from Operating Activity". */
  readonly cashFromOperating: Crore
  /** Screener "Cash from Investing Activity". */
  readonly cashFromInvesting: Crore
  /** Screener "Cash from Financing Activity". */
  readonly cashFromFinancing: Crore
  /** Screener "Net Cash Flow" — the sum of the three activity lines. */
  readonly netCashFlow: Crore
}

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

/** A statement's periods, or the reason the statement is missing entirely. */
export type StatementSeries<TPeriod> = Availability<{ readonly periods: readonly TPeriod[] }>

/** Everything reported at one cadence. */
export interface StatementSet {
  readonly cadence: PeriodCadence
  readonly profitLoss: StatementSeries<ProfitLossPeriod>
  readonly balanceSheet: StatementSeries<BalanceSheetPeriod>
  readonly cashFlow: StatementSeries<CashFlowPeriod>
  readonly segmentMix: SegmentMix
}

/**
 * A peer reference: another listed company Screener names as a comparable. Just
 * the identity — the peer's KPIs are derived from *its own* scraped statements
 * when we hold them, so nothing is carried or fabricated here.
 */
export interface PeerRef {
  /** NSE symbol — joins to that company's `data/<symbol>.json`. */
  readonly symbol: string
  readonly name: string
  /** Market cap as Screener's peer table showed it, for ranking/labels. */
  readonly marketCapCrore?: Reported<Crore>
}

export interface CompanyFinancials {
  /** Joins to `MockCompany.id` in `src/mocks/companies.ts`. */
  readonly companyId: string
  readonly currency: 'INR'
  /** Unit of every `Crore` field. Explicit so a future USD/absolute source
   * cannot be mistaken for this one. */
  readonly unit: 'crore'
  readonly statementLayout: StatementLayout
  /** Calendar month the financial year ends in. 3 (March) for Indian filers. */
  readonly fiscalYearEndMonth: number
  /** Shares outstanding in crore, used to reconcile EPS. */
  readonly sharesOutstandingCrore: number
  readonly source: DataSource
  /** Last 5 quarters. P&L available; balance sheet and cash flow typically not. */
  readonly quarterly: StatementSet
  /** Last 5 financial years. All three statements available. */
  readonly annual: StatementSet
  /** Comparable companies from Screener's peer table. Optional: older files
   * predate it, and a company may have no peer table. */
  readonly peers?: readonly PeerRef[]
}

/* -------------------------------------------------------------------------- */
/* Narrowing helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Periods of a statement, or an empty array when it is unavailable.
 *
 * For rendering only. Anything that needs to tell "no data" from "not
 * published" must branch on `status` and read `reason` — an empty array cannot
 * carry that distinction.
 */
export function periodsOf<TPeriod>(series: StatementSeries<TPeriod>): readonly TPeriod[] {
  return series.status === 'available' ? series.periods : []
}

/** The most recent period of a statement, or `null` when it is unavailable. */
export function latestPeriodOf<TPeriod>(series: StatementSeries<TPeriod>): TPeriod | null {
  const periods = periodsOf(series)
  return periods.length > 0 ? periods[periods.length - 1] : null
}
