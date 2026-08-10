/**
 * Excel export — the real numbers, not a picture.
 *
 * Builds an .xlsx with a sheet per statement (for the selected period view),
 * a KPI sheet and a peer-comparison sheet, all as raw values so an analyst can
 * compute on them. A not-reported figure is an empty cell, never a zero.
 */

import type * as XLSXNS from 'xlsx'
import type { CompanyFinancials, StatementSeries } from '@/types/financials'
import { periodsOf } from '@/types/financials'
import type { PeriodRef } from '@/types/period'
import type { PeriodViewId } from '@/config/navigation'
import type { Reported } from '@/types/common'
import { statementSetFor } from '@/lib/statements'
import { KPI_DEFINITIONS } from '@/config/kpis'
import { deriveKpis } from '../data/metrics'
import { buildPeerRows } from '../data/peerKpis'

type Cell = string | number | null
type Row<P> = { label: string; value: (p: P) => Reported<number> }

function sheetFor<P extends { period: PeriodRef }>(
  XLSX: typeof XLSXNS,
  series: StatementSeries<P>,
  rows: readonly Row<P>[],
): XLSXNS.WorkSheet | null {
  if (series.status !== 'available') return null
  const periods = periodsOf(series)
  if (periods.length === 0) return null
  const aoa: Cell[][] = [['₹ crore', ...periods.map((p) => p.period.label)]]
  for (const row of rows) {
    aoa.push([row.label, ...periods.map((p) => row.value(p))])
  }
  return XLSX.utils.aoa_to_sheet(aoa)
}

/** Build and download `<TICKER>-earnings-<period>.xlsx`. */
export async function exportFinancialsXlsx(
  financials: CompanyFinancials,
  period: PeriodViewId,
  companyName: string,
): Promise<void> {
  // Loaded on demand so the heavy spreadsheet library stays out of the
  // dashboard's initial bundle.
  const XLSX = await import('xlsx')
  const set = statementSetFor(financials, period)
  const banking = financials.statementLayout === 'banking'
  const wb = XLSX.utils.book_new()

  const plSheet = sheetFor(XLSX, set.profitLoss, [
    { label: banking ? 'Revenue' : 'Sales', value: (p) => p.sales },
    { label: 'Expenses', value: (p) => p.expenses },
    { label: banking ? 'Financing Profit' : 'Operating Profit', value: (p) => p.operatingProfit },
    { label: banking ? 'Financing Margin %' : 'OPM %', value: (p) => p.opmPercent },
    { label: 'Other Income', value: (p) => p.otherIncome },
    { label: 'Interest', value: (p) => p.interest },
    { label: 'Depreciation', value: (p) => p.depreciation },
    { label: 'Profit before Tax', value: (p) => p.profitBeforeTax },
    { label: 'Tax %', value: (p) => p.taxPercent },
    { label: 'Net Profit', value: (p) => p.netProfit },
    { label: 'Net Margin %', value: (p) => (p.sales === 0 ? null : (p.netProfit / p.sales) * 100) },
    { label: 'EPS (₹)', value: (p) => p.eps },
  ])
  if (plSheet) XLSX.utils.book_append_sheet(wb, plSheet, 'P&L')

  const bsSheet = sheetFor(XLSX, set.balanceSheet, [
    { label: 'Equity Capital', value: (p) => p.equityCapital },
    { label: 'Reserves', value: (p) => p.reserves },
    { label: 'Borrowings', value: (p) => p.borrowings },
    { label: 'Other Liabilities', value: (p) => p.otherLiabilities },
    { label: 'Total Liabilities', value: (p) => p.totalLiabilities },
    { label: 'Fixed Assets', value: (p) => p.fixedAssets },
    { label: 'CWIP', value: (p) => p.cwip },
    { label: 'Investments', value: (p) => p.investments },
    { label: 'Other Assets', value: (p) => p.otherAssets },
    { label: 'Total Assets', value: (p) => p.totalAssets },
  ])
  if (bsSheet) XLSX.utils.book_append_sheet(wb, bsSheet, 'Balance Sheet')

  const cfSheet = sheetFor(XLSX, set.cashFlow, [
    { label: 'Cash from Operations (CFO)', value: (p) => p.cashFromOperating },
    { label: 'Working-capital change', value: (p) => p.workingCapitalChange },
    { label: 'Cash from Investing (CFI)', value: (p) => p.cashFromInvesting },
    { label: 'Cash from Financing (CFF)', value: (p) => p.cashFromFinancing },
    { label: 'Net Cash Flow', value: (p) => p.netCashFlow },
  ])
  if (cfSheet) XLSX.utils.book_append_sheet(wb, cfSheet, 'Cash Flow')

  // KPIs — trailing series for the selected cadence.
  const kpis = deriveKpis(set)
  if (kpis.length && kpis[0].series.length) {
    const kpiAoa: Cell[][] = [['KPI', ...kpis[0].series.map((s) => s.label)]]
    for (const kpi of kpis) kpiAoa.push([kpi.definition.label, ...kpi.series.map((s) => s.value)])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiAoa), 'KPIs')
  }

  // Peers — latest-FY comparison.
  const peerRows = await buildPeerRows(financials, companyName)
  if (peerRows.length > 1) {
    const header = ['Company', 'Type', 'Mkt Cap (₹cr)', ...KPI_DEFINITIONS.map((d) => d.shortLabel)]
    const peerAoa: Cell[][] = [header]
    for (const row of peerRows) {
      peerAoa.push([
        row.name,
        row.isSubject ? 'subject' : row.origin,
        row.marketCap,
        ...KPI_DEFINITIONS.map((d) => row.kpis.get(d.id) ?? null),
      ])
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(peerAoa), 'Peers')
  }

  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No data available to export']]), 'Info')
  }

  XLSX.writeFile(wb, `${financials.companyId}-earnings-${period}.xlsx`)
}
