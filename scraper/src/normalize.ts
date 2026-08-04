/**
 * Turning raw Screener tables into the exact schema types.
 *
 * Nothing here invents a shape: the output is `CompanyFinancials` /
 * `ProfitLossPeriod` / `BalanceSheetPeriod` / `CashFlowPeriod` straight from
 * `src/types/financials.ts`, and the "not published" cases use the schema's own
 * `Availability<T>` / `Reported<T>` conventions rather than a parallel pattern.
 *
 * What Screener reports directly is extracted; what it only rounds (OPM %,
 * Tax %) is derived from the exact ₹-crore lines, matching how the mock derives
 * them — Screener prints those percentages as integers, so deriving keeps the
 * schema's precision. What Screener doesn't expose at all (quarterly balance
 * sheet and cash flow, the cash-flow working-capital breakout, segment mix) is
 * marked unavailable/null, never faked as zero.
 */

import type { UnavailableReason } from '../../src/types/common'
import type {
  BalanceSheetPeriod,
  CashFlowPeriod,
  CompanyFinancials,
  ProfitLossPeriod,
  StatementLayout,
  StatementSet,
} from '../../src/types/financials'
import type { PeriodCadence, PeriodRef } from '../../src/types/period'
import type { ScraperCompany } from './companies'
import type { RawTable, StatementBasis } from './extract'
import { parseCell, round } from './numbers'
import { parsePeriodHeader } from './periods'

/** How many trailing periods to keep, matching the five the frontend renders. */
const MAX_PERIODS = 5

/** Throw a loud, specific error — company, statement, and reason — and stop. */
function fail(symbol: string, statement: string, reason: string): never {
  throw new Error(`${symbol} · ${statement}: ${reason}`)
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '')
    .trim()
}

interface Column {
  readonly period: PeriodRef
  /** Index into a row's `cells` array. */
  readonly index: number
}

/** The last `MAX_PERIODS` real period columns, oldest → newest. */
function selectColumns(table: RawTable, cadence: PeriodCadence): Column[] {
  const columns: Column[] = []
  // headers[0] is the label column; data column h maps to cells[h - 1].
  for (let h = 1; h < table.headers.length; h++) {
    const period = parsePeriodHeader(table.headers[h], cadence)
    if (period) columns.push({ period, index: h - 1 })
  }
  return columns.slice(-MAX_PERIODS)
}

/** A label → cells lookup over a table's rows, matched case-insensitively. */
function rowLookup(table: RawTable): (names: readonly string[]) => readonly string[] | null {
  const byLabel = new Map<string, readonly string[]>()
  for (const row of table.rows) {
    const key = normalizeLabel(row.label)
    if (!byLabel.has(key)) byLabel.set(key, row.cells)
  }
  return (names) => {
    for (const name of names) {
      const exact = byLabel.get(name)
      if (exact) return exact
    }
    // Tolerate a trailing suffix, e.g. "EPS in Rs" vs "EPS in Rs.".
    for (const name of names) {
      for (const [key, cells] of byLabel) if (key.startsWith(name)) return cells
    }
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Layout detection                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Banks and NBFCs get Screener's "Revenue / Interest / Financing Profit /
 * Financing Margin %" P&L; everyone else gets "Sales / Operating Profit /
 * OPM %". Detected from the row labels present, never forced.
 */
function detectLayout(profitLoss: RawTable, symbol: string): StatementLayout {
  const labels = new Set(profitLoss.rows.map((row) => normalizeLabel(row.label)))
  if (labels.has('financing profit') || labels.has('financing margin %')) return 'banking'
  if (labels.has('operating profit') || labels.has('opm %')) return 'standard'
  fail(symbol, 'P&L', 'could not detect layout — no Operating Profit or Financing Profit row')
}

/* -------------------------------------------------------------------------- */
/* Statement parsing                                                          */
/* -------------------------------------------------------------------------- */

function parseProfitLoss(
  table: RawTable,
  cadence: PeriodCadence,
  layout: StatementLayout,
  symbol: string,
): ProfitLossPeriod[] {
  const statement = `${cadence} P&L`
  const columns = selectColumns(table, cadence)
  if (columns.length === 0) fail(symbol, statement, 'no period columns found')

  const find = rowLookup(table)
  const salesRow = find(['sales', 'revenue'])
  const expensesRow = find(['expenses'])
  const operatingProfitRow = find(layout === 'banking' ? ['financing profit'] : ['operating profit'])
  const otherIncomeRow = find(['other income'])
  const interestRow = find(['interest'])
  const profitBeforeTaxRow = find(['profit before tax'])
  const netProfitRow = find(['net profit'])
  const depreciationRow = find(['depreciation'])
  const epsRow = find(['eps in rs'])

  const requiredRows: [string, readonly string[] | null][] = [
    ['Sales/Revenue', salesRow],
    ['Expenses', expensesRow],
    ['Operating/Financing Profit', operatingProfitRow],
    ['Other Income', otherIncomeRow],
    ['Interest', interestRow],
    ['Profit before tax', profitBeforeTaxRow],
    ['Net Profit', netProfitRow],
  ]
  for (const [name, row] of requiredRows) {
    if (!row) fail(symbol, statement, `row not found: ${name}`)
  }

  return columns.map(({ period, index }): ProfitLossPeriod => {
    const required = (row: readonly string[], field: string): number => {
      const value = parseCell(row[index] ?? '')
      if (value === null) fail(symbol, statement, `${period.label}: '${field}' is blank/unparseable`)
      return value
    }
    const optional = (row: readonly string[] | null): number | null =>
      row ? parseCell(row[index] ?? '') : null

    const sales = required(salesRow as readonly string[], 'sales')
    const expenses = required(expensesRow as readonly string[], 'expenses')
    const operatingProfit = required(operatingProfitRow as readonly string[], 'operatingProfit')
    const otherIncome = required(otherIncomeRow as readonly string[], 'otherIncome')
    const interest = required(interestRow as readonly string[], 'interest')
    const profitBeforeTax = required(profitBeforeTaxRow as readonly string[], 'profitBeforeTax')
    const netProfit = required(netProfitRow as readonly string[], 'netProfit')

    // Screener prints OPM %/Financing Margin % and Tax % rounded to integers, so
    // derive them from the exact ₹-crore lines — the same identities the schema
    // documents (OPM = operating profit ÷ sales; effective tax = 1 − PAT ÷ PBT).
    const opmPercent = sales !== 0 ? round((operatingProfit / sales) * 100, 2) : 0
    const taxPercent =
      profitBeforeTax !== 0 ? round(((profitBeforeTax - netProfit) / profitBeforeTax) * 100, 2) : 0

    return {
      period,
      sales,
      expenses,
      operatingProfit,
      opmPercent,
      otherIncome,
      interest,
      depreciation: optional(depreciationRow),
      profitBeforeTax,
      taxPercent,
      netProfit,
      eps: optional(epsRow),
    }
  })
}

function parseBalanceSheet(table: RawTable, symbol: string): BalanceSheetPeriod[] {
  const statement = 'annual balance sheet'
  const columns = selectColumns(table, 'annual')
  if (columns.length === 0) fail(symbol, statement, 'no period columns found')

  const find = rowLookup(table)
  const rows = {
    equityCapital: find(['equity capital']),
    reserves: find(['reserves']),
    // Banks label this "Borrowing"; everyone else "Borrowings".
    borrowings: find(['borrowings', 'borrowing']),
    otherLiabilities: find(['other liabilities']),
    totalLiabilities: find(['total liabilities']),
    fixedAssets: find(['fixed assets']),
    cwip: find(['cwip']),
    investments: find(['investments']),
    otherAssets: find(['other assets']),
    totalAssets: find(['total assets']),
  }
  // A bank's balance sheet splits funding into "Deposits" + "Borrowing"; the
  // schema carries a single `borrowings`, so deposits — a lender's primary
  // borrowed funding — are summed into it. Absent (null) for non-banks.
  const depositsRow = find(['deposits'])

  // CWIP is legitimately blank for lenders, so it is the one non-required row.
  const requiredRows = [
    'equityCapital', 'reserves', 'borrowings', 'otherLiabilities', 'totalLiabilities',
    'fixedAssets', 'investments', 'otherAssets', 'totalAssets',
  ] as const
  for (const key of requiredRows) {
    if (!rows[key]) fail(symbol, statement, `row not found: ${key}`)
  }

  return columns.map(({ period, index }): BalanceSheetPeriod => {
    const required = (row: readonly string[], field: string): number => {
      const value = parseCell(row[index] ?? '')
      if (value === null) fail(symbol, statement, `${period.label}: '${field}' is blank/unparseable`)
      return value
    }
    const deposits = depositsRow ? (parseCell(depositsRow[index] ?? '') ?? 0) : 0
    return {
      period,
      equityCapital: required(rows.equityCapital as readonly string[], 'equityCapital'),
      reserves: required(rows.reserves as readonly string[], 'reserves'),
      borrowings: required(rows.borrowings as readonly string[], 'borrowings') + deposits,
      otherLiabilities: required(rows.otherLiabilities as readonly string[], 'otherLiabilities'),
      totalLiabilities: required(rows.totalLiabilities as readonly string[], 'totalLiabilities'),
      fixedAssets: required(rows.fixedAssets as readonly string[], 'fixedAssets'),
      cwip: rows.cwip ? parseCell(rows.cwip[index] ?? '') : null,
      investments: required(rows.investments as readonly string[], 'investments'),
      otherAssets: required(rows.otherAssets as readonly string[], 'otherAssets'),
      totalAssets: required(rows.totalAssets as readonly string[], 'totalAssets'),
    }
  })
}

function parseCashFlow(table: RawTable, symbol: string): CashFlowPeriod[] {
  const statement = 'annual cash flow'
  const columns = selectColumns(table, 'annual')
  if (columns.length === 0) fail(symbol, statement, 'no period columns found')

  const find = rowLookup(table)
  const cfoRow = find(['cash from operating activity'])
  const cfiRow = find(['cash from investing activity'])
  const cffRow = find(['cash from financing activity'])
  const netRow = find(['net cash flow'])

  const requiredRows: [string, readonly string[] | null][] = [
    ['Cash from Operating Activity', cfoRow],
    ['Cash from Investing Activity', cfiRow],
    ['Cash from Financing Activity', cffRow],
    ['Net Cash Flow', netRow],
  ]
  for (const [name, row] of requiredRows) {
    if (!row) fail(symbol, statement, `row not found: ${name}`)
  }

  return columns.map(({ period, index }): CashFlowPeriod => {
    const required = (row: readonly string[], field: string): number => {
      const value = parseCell(row[index] ?? '')
      if (value === null) fail(symbol, statement, `${period.label}: '${field}' is blank/unparseable`)
      return value
    }
    return {
      period,
      // Screener's condensed cash flow shows only the three activity totals and
      // the net; the working-capital breakout is in the expanded view we do not
      // scrape, so those lines are null (the schema models them as nullable).
      operatingProfitBeforeWorkingCapital: null,
      workingCapitalChange: null,
      taxPaid: null,
      cashFromOperating: required(cfoRow as readonly string[], 'cashFromOperating'),
      cashFromInvesting: required(cfiRow as readonly string[], 'cashFromInvesting'),
      cashFromFinancing: required(cffRow as readonly string[], 'cashFromFinancing'),
      netCashFlow: required(netRow as readonly string[], 'netCashFlow'),
    }
  })
}

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

function unavailable(reason: UnavailableReason, note: string) {
  return { status: 'unavailable', reason, note } as const
}

/** Quarterly BS/CF genuinely don't exist for Indian filers at this cadence. */
const QUARTERLY_STATEMENT_UNAVAILABLE = unavailable(
  'not-reported',
  'Indian filers report the balance sheet and cash flow statement half-yearly at the earliest; Screener publishes annual columns only.',
)

/** Segment disclosure is a separate filing, not read from the company page. */
const SEGMENT_MIX_UNAVAILABLE = unavailable(
  'not-scraped',
  'Segment revenue is a separate disclosure and is not scraped from the Screener company page in this phase.',
)

export interface CompanySections {
  readonly quarters: RawTable | null
  readonly profitLoss: RawTable | null
  readonly balanceSheet: RawTable | null
  readonly cashFlow: RawTable | null
}

/** Derive shares outstanding (crore) from the newest year with EPS reported. */
function deriveSharesOutstandingCrore(annualProfitLoss: readonly ProfitLossPeriod[]): number | null {
  for (let i = annualProfitLoss.length - 1; i >= 0; i--) {
    const entry = annualProfitLoss[i]
    if (entry.eps !== null && entry.eps !== 0) return round(entry.netProfit / entry.eps, 0)
  }
  return null
}

/**
 * Assemble one company's `CompanyFinancials` from its scraped sections.
 * Pure and browserless, so it can be exercised against saved page fixtures.
 */
export function normalizeCompany(
  company: ScraperCompany,
  sections: CompanySections,
  basis: StatementBasis,
  url: string,
  fetchedAt: string,
): CompanyFinancials {
  const { screenerSymbol: symbol } = company
  if (!sections.profitLoss) fail(symbol, 'annual P&L', 'section #profit-loss not found on page')
  if (!sections.quarters) fail(symbol, 'quarterly P&L', 'section #quarters not found on page')
  if (!sections.balanceSheet) fail(symbol, 'annual balance sheet', 'section #balance-sheet not found')
  if (!sections.cashFlow) fail(symbol, 'annual cash flow', 'section #cash-flow not found on page')

  const layout = detectLayout(sections.profitLoss, symbol)
  const annualProfitLoss = parseProfitLoss(sections.profitLoss, 'annual', layout, symbol)
  const quarterlyProfitLoss = parseProfitLoss(sections.quarters, 'quarterly', layout, symbol)
  const annualBalanceSheet = parseBalanceSheet(sections.balanceSheet, symbol)
  const annualCashFlow = parseCashFlow(sections.cashFlow, symbol)

  if (annualProfitLoss.length === 0) fail(symbol, 'annual P&L', 'no annual periods parsed')
  const latest = annualProfitLoss[annualProfitLoss.length - 1]

  const sharesOutstandingCrore = deriveSharesOutstandingCrore(annualProfitLoss)
  if (sharesOutstandingCrore === null) {
    fail(symbol, 'annual P&L', 'cannot derive shares outstanding — no year reports EPS')
  }
  const fiscalYearEndMonth = Number(latest.period.endDate.slice(5, 7))

  const quarterly: StatementSet = {
    cadence: 'quarterly',
    profitLoss: { status: 'available', periods: quarterlyProfitLoss },
    balanceSheet: QUARTERLY_STATEMENT_UNAVAILABLE,
    cashFlow: QUARTERLY_STATEMENT_UNAVAILABLE,
    segmentMix: SEGMENT_MIX_UNAVAILABLE,
  }

  const annual: StatementSet = {
    cadence: 'annual',
    profitLoss: { status: 'available', periods: annualProfitLoss },
    balanceSheet: { status: 'available', periods: annualBalanceSheet },
    cashFlow: { status: 'available', periods: annualCashFlow },
    segmentMix: SEGMENT_MIX_UNAVAILABLE,
  }

  return {
    companyId: company.companyId,
    currency: 'INR',
    unit: 'crore',
    statementLayout: layout,
    fiscalYearEndMonth,
    sharesOutstandingCrore,
    source: { provider: 'screener', url, fetchedAt, basis },
    quarterly,
    annual,
  }
}
