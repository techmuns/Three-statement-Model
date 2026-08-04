/**
 * Runtime validation for scraped `data/<SYMBOL>.json` files.
 *
 * These files come from outside the type system (the scraper writes them; a
 * human might hand-edit or truncate one), so before the app trusts a file as
 * `CompanyFinancials` it is structurally checked here. A file that fails — a
 * malformed shape, a missing statement, a period with a non-numeric figure — is
 * rejected so the loader can fall back to that company's mock data rather than
 * feed a broken object into a view. The checks mirror the schema in
 * `src/types/financials.ts` field-for-field.
 */

import type { CompanyFinancials } from '@/types/financials'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const isNum = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const isNumOrNull = (value: unknown): boolean => value === null || isNum(value)
const isStr = (value: unknown): value is string => typeof value === 'string'

function isPeriodRef(value: unknown): boolean {
  return (
    isRecord(value) &&
    isStr(value.id) &&
    isStr(value.label) &&
    isStr(value.longLabel) &&
    (value.cadence === 'quarterly' || value.cadence === 'annual') &&
    isNum(value.fiscalYear) &&
    isStr(value.endDate)
  )
}

function isProfitLossPeriod(value: unknown): boolean {
  return (
    isRecord(value) &&
    isPeriodRef(value.period) &&
    isNum(value.sales) &&
    isNum(value.expenses) &&
    isNum(value.operatingProfit) &&
    isNum(value.opmPercent) &&
    isNum(value.otherIncome) &&
    isNum(value.interest) &&
    isNumOrNull(value.depreciation) &&
    isNum(value.profitBeforeTax) &&
    isNum(value.taxPercent) &&
    isNum(value.netProfit) &&
    isNumOrNull(value.eps)
  )
}

function isBalanceSheetPeriod(value: unknown): boolean {
  return (
    isRecord(value) &&
    isPeriodRef(value.period) &&
    isNum(value.equityCapital) &&
    isNum(value.reserves) &&
    isNum(value.borrowings) &&
    isNum(value.otherLiabilities) &&
    isNum(value.totalLiabilities) &&
    isNum(value.fixedAssets) &&
    isNumOrNull(value.cwip) &&
    isNum(value.investments) &&
    isNum(value.otherAssets) &&
    isNum(value.totalAssets)
  )
}

function isCashFlowPeriod(value: unknown): boolean {
  return (
    isRecord(value) &&
    isPeriodRef(value.period) &&
    isNumOrNull(value.operatingProfitBeforeWorkingCapital) &&
    isNumOrNull(value.workingCapitalChange) &&
    isNumOrNull(value.taxPaid) &&
    isNum(value.cashFromOperating) &&
    isNum(value.cashFromInvesting) &&
    isNum(value.cashFromFinancing) &&
    isNum(value.netCashFlow)
  )
}

/**
 * An `Availability<T>`. `periodPred` validates each entry of an available
 * statement's `periods`; omit it for the segment mix (whose available payload is
 * `segments`, not `periods`).
 */
function isAvailability(value: unknown, periodPred?: (entry: unknown) => boolean): boolean {
  if (!isRecord(value)) return false
  if (value.status === 'unavailable') return isStr(value.reason)
  if (value.status !== 'available') return false
  if (!periodPred) return Array.isArray(value.segments)
  return Array.isArray(value.periods) && value.periods.every(periodPred)
}

function isStatementSet(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.cadence === 'quarterly' || value.cadence === 'annual') &&
    isAvailability(value.profitLoss, isProfitLossPeriod) &&
    isAvailability(value.balanceSheet, isBalanceSheetPeriod) &&
    isAvailability(value.cashFlow, isCashFlowPeriod) &&
    isAvailability(value.segmentMix)
  )
}

function isDataSource(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.provider === 'screener' || value.provider === 'bse' || value.provider === 'mock') &&
    isStr(value.fetchedAt) &&
    (value.basis === 'consolidated' || value.basis === 'standalone') &&
    (value.url === undefined || isStr(value.url))
  )
}

/** Whether an unknown parsed JSON value is a well-formed `CompanyFinancials`. */
export function isCompanyFinancials(value: unknown): value is CompanyFinancials {
  return (
    isRecord(value) &&
    isStr(value.companyId) &&
    value.currency === 'INR' &&
    value.unit === 'crore' &&
    (value.statementLayout === 'standard' || value.statementLayout === 'banking') &&
    isNum(value.fiscalYearEndMonth) &&
    isNum(value.sharesOutstandingCrore) &&
    isDataSource(value.source) &&
    isStatementSet(value.quarterly) &&
    isStatementSet(value.annual)
  )
}
