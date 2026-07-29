/**
 * Navigation shape for the dashboard shell.
 *
 * This is UI structure, not a data schema — it describes which panels exist,
 * not what they contain. Adding a tab in a later phase is an edit here plus a
 * view component; nothing else in the shell needs to change.
 */

export type PrimaryTabId = 'financials' | 'kpi'
export type FinancialsTabId = 'pl' | 'balance-sheet' | 'cash-flow'
export type PeriodViewId = 'quarters' | 'years'

export interface NavItem<Id extends string> {
  id: Id
  label: string
  /** Announced to screen readers where the visible label is terse. */
  description?: string
}

export const PRIMARY_TABS: readonly NavItem<PrimaryTabId>[] = [
  { id: 'financials', label: 'Financials', description: 'Statement-level financials' },
  { id: 'kpi', label: 'KPI Overview', description: 'Headline operating metrics' },
]

export const FINANCIALS_TABS: readonly NavItem<FinancialsTabId>[] = [
  { id: 'pl', label: 'P&L', description: 'Profit and loss statement' },
  { id: 'balance-sheet', label: 'Balance Sheet' },
  { id: 'cash-flow', label: 'Cash Flow' },
]

export const PERIOD_VIEWS: readonly NavItem<PeriodViewId>[] = [
  { id: 'quarters', label: 'Last 5 Quarters' },
  { id: 'years', label: 'Last 5 Years' },
]

export const DEFAULT_PRIMARY_TAB: PrimaryTabId = 'financials'
export const DEFAULT_FINANCIALS_TAB: FinancialsTabId = 'pl'
export const DEFAULT_PERIOD_VIEW: PeriodViewId = 'quarters'
