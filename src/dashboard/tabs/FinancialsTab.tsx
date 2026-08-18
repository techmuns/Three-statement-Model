/**
 * Point 1 of the Dhamma scope: last-5 P&L (with revenue mix by segment),
 * balance sheet, and a condensed cash flow (CFO, working-capital change, CFI,
 * CFF) — with the 5-quarter / 5-year toggle applied by the parent.
 *
 * Indian companies file the balance sheet and cash flow annually, so in the
 * 5-quarter view those two are honestly unavailable and point the user at the
 * 5-year view rather than showing a blank or a fabricated column.
 */

import type { PeriodViewId } from '@/config/navigation'
import type {
  BalanceSheetPeriod,
  CashFlowPeriod,
  CompanyFinancials,
  ProfitLossPeriod,
  StatementSeries,
} from '@/types/financials'
import { periodsOf } from '@/types/financials'
import type { PeriodRef } from '@/types/period'
import { statementSetFor } from '@/lib/statements'
import { WidgetCard } from '../ui/WidgetCard'
import { LoadingState, UnavailableState } from '../ui/states'
import { StatementTable, type StatementRow } from '../components/StatementTable'
import { SegmentMix } from '../components/SegmentMix'
import { ConcallSegmentMix } from '../components/ConcallSegmentMix'
import { useConcallSegments } from '../data/useConcallSegments'
import { T } from '../ui/tokens'

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const annualOnlyHint = 'Indian companies file this statement annually — switch to the 5-year view.'

/** Render a statement's periods, or the honest reason it is missing. */
function SeriesBody<P extends { period: PeriodRef }>({
  series,
  rows,
  emptyHint,
}: {
  series: StatementSeries<P>
  rows: readonly StatementRow<P>[]
  emptyHint: string
}) {
  if (series.status !== 'available') {
    return <UnavailableState note={series.note ?? 'Not reported at this cadence.'} hint={emptyHint} />
  }
  const periods = periodsOf(series)
  if (periods.length === 0) return <UnavailableState note="No periods reported." hint={emptyHint} />
  return <StatementTable periods={periods} rows={rows} />
}

export function FinancialsTab({
  financials,
  period,
}: {
  financials: CompanyFinancials
  period: PeriodViewId
}) {
  const set = statementSetFor(financials, period)
  const concall = useConcallSegments(financials.companyId)
  const banking = financials.statementLayout === 'banking'
  const source = financials.source
  const provenance = `Screener · ${source.basis} · updated ${shortDate(source.fetchedAt)}`

  const plRows: readonly StatementRow<ProfitLossPeriod>[] = [
    { label: banking ? 'Revenue' : 'Sales', kind: 'crore', value: (p) => p.sales },
    { label: 'Expenses', kind: 'crore', value: (p) => p.expenses },
    { label: banking ? 'Financing Profit' : 'Operating Profit', kind: 'crore', emphasis: true, value: (p) => p.operatingProfit },
    { label: banking ? 'Financing Margin %' : 'OPM %', kind: 'percent', value: (p) => p.opmPercent },
    { label: 'Other Income', kind: 'crore', value: (p) => p.otherIncome },
    { label: 'Interest', kind: 'crore', value: (p) => p.interest },
    { label: 'Depreciation', kind: 'crore', value: (p) => p.depreciation },
    { label: 'Profit before Tax', kind: 'crore', emphasis: true, value: (p) => p.profitBeforeTax },
    { label: 'Tax %', kind: 'percent', value: (p) => p.taxPercent },
    { label: 'Net Profit', kind: 'crore', emphasis: true, value: (p) => p.netProfit },
    { label: 'Net Margin %', kind: 'percent', sub: true, value: (p) => (p.sales === 0 ? null : (p.netProfit / p.sales) * 100) },
    { label: 'EPS', kind: 'rupees', value: (p) => p.eps },
  ]

  const bsRows: readonly StatementRow<BalanceSheetPeriod>[] = [
    { label: 'Equity Capital', kind: 'crore', value: (p) => p.equityCapital },
    { label: 'Reserves', kind: 'crore', value: (p) => p.reserves },
    { label: 'Borrowings', kind: 'crore', value: (p) => p.borrowings },
    { label: 'Other Liabilities', kind: 'crore', value: (p) => p.otherLiabilities },
    { label: 'Total Liabilities', kind: 'crore', emphasis: true, value: (p) => p.totalLiabilities },
    { label: 'Fixed Assets', kind: 'crore', value: (p) => p.fixedAssets },
    { label: 'CWIP', kind: 'crore', value: (p) => p.cwip },
    { label: 'Investments', kind: 'crore', value: (p) => p.investments },
    { label: 'Other Assets', kind: 'crore', value: (p) => p.otherAssets },
    { label: 'Total Assets', kind: 'crore', emphasis: true, value: (p) => p.totalAssets },
  ]

  // Condensed cash flow: exactly the four lines the client asked for, plus the
  // net movement as the closing total.
  const cfRows: readonly StatementRow<CashFlowPeriod>[] = [
    { label: 'Cash from Operations (CFO)', kind: 'crore', emphasis: true, value: (p) => p.cashFromOperating },
    { label: 'of which: working-capital change', kind: 'crore', sub: true, value: (p) => p.workingCapitalChange },
    { label: 'Cash from Investing (CFI)', kind: 'crore', value: (p) => p.cashFromInvesting },
    { label: 'Cash from Financing (CFF)', kind: 'crore', value: (p) => p.cashFromFinancing },
    { label: 'Net Cash Flow', kind: 'crore', emphasis: true, value: (p) => p.netCashFlow },
  ]

  const plPeriods = periodsOf(set.profitLoss)
  const latestPeriodId = plPeriods.length ? plPeriods[plPeriods.length - 1].period.id : null

  return (
    <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))' }}>
      <WidgetCard title="Profit & Loss" subtitle={provenance} wide>
        <SeriesBody series={set.profitLoss} rows={plRows} emptyHint="P&L is not available for this company yet." />
      </WidgetCard>

      <WidgetCard
        title="Revenue Mix by Segment"
        subtitle={
          set.segmentMix.status === 'available'
            ? 'Product segments · share of sales, latest period'
            : concall.data
              ? `From the earnings call · ${concall.data.quarter ?? 'latest'}`
              : 'Share of sales, latest period'
        }
      >
        {set.segmentMix.status === 'available' && latestPeriodId ? (
          <SegmentMix segments={set.segmentMix.segments} periodId={latestPeriodId} />
        ) : concall.data ? (
          <ConcallSegmentMix segments={concall.data.segments} quarter={concall.data.quarter} />
        ) : concall.loading ? (
          <LoadingState rows={4} />
        ) : (
          <UnavailableState
            note={set.segmentMix.status === 'available' ? 'No segment split for this period.' : set.segmentMix.note ?? 'Segment mix not reported.'}
            hint="Sourced from the company's earnings call when available (via the Concall Deep Dive)."
          />
        )}
      </WidgetCard>

      <WidgetCard title="Balance Sheet" subtitle={provenance} wide>
        <SeriesBody series={set.balanceSheet} rows={bsRows} emptyHint={annualOnlyHint} />
      </WidgetCard>

      <WidgetCard title="Cash Flow (condensed)" subtitle="CFO · working-capital · CFI · CFF" wide>
        <SeriesBody series={set.cashFlow} rows={cfRows} emptyHint={annualOnlyHint} />
      </WidgetCard>

      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: T.inkHint, paddingTop: 4 }}>
        Figures in ₹ crore. “—” means the company did not report that line — never a zero. {provenance}.
      </div>
    </div>
  )
}
