import type { PeriodViewId } from '@/config/navigation'
import { BalanceSheetCompositionChart } from '@/components/charts/BalanceSheetCompositionChart'
import { AnnualOnlyNotice } from '@/components/widgets/AnnualOnlyNotice'
import { StatementTable, type StatementTableRow } from '@/components/widgets/StatementTable'
import { StatList, type StatTileProps } from '@/components/widgets/StatTile'
import { WidgetCard } from '@/components/widgets/WidgetCard'
import { WidgetEmptyState } from '@/components/widgets/WidgetEmptyState'
import { WidgetGrid } from '@/components/widgets/WidgetGrid'
import { formatCrore, formatSignedPercent, percentChange } from '@/lib/format'
import { sourceFootnote } from '@/lib/provenance'
import { basisLabel } from '@/lib/statementLabels'
import type { MockCompany } from '@/mocks/companies'
import { getCompanyFinancials } from '@/mocks/financials'
import type { Reported } from '@/types/common'
import { periodsOf, type BalanceSheetPeriod } from '@/types/financials'

export interface BalanceSheetPanelProps {
  company: MockCompany
  period: PeriodViewId
}

/**
 * Neutral tone on purpose. A bigger balance sheet is not per se good or bad —
 * more borrowings, more assets — so the arrow and signed value carry direction
 * without a good/bad colour the data does not support. Always YoY because the
 * balance sheet is annual only.
 */
function yoyDelta(current: number, previous: Reported<number>): StatTileProps['delta'] {
  const change = percentChange(current, previous)
  if (change === null) return undefined
  return { label: `${formatSignedPercent(change)} YoY`, tone: 'neutral' }
}

function headlineStats(periods: readonly BalanceSheetPeriod[]): StatTileProps[] {
  const latest = periods[periods.length - 1]
  const previous = periods.length > 1 ? periods[periods.length - 2] : null
  return [
    {
      label: `Total Assets — ${latest.period.label}`,
      value: formatCrore(latest.totalAssets),
      delta: yoyDelta(latest.totalAssets, previous?.totalAssets ?? null),
    },
    {
      label: 'Total Liabilities',
      value: formatCrore(latest.totalLiabilities),
      delta: yoyDelta(latest.totalLiabilities, previous?.totalLiabilities ?? null),
    },
    {
      label: 'Reserves',
      value: formatCrore(latest.reserves),
      delta: yoyDelta(latest.reserves, previous?.reserves ?? null),
    },
    {
      label: 'Borrowings',
      value: formatCrore(latest.borrowings),
      delta: yoyDelta(latest.borrowings, previous?.borrowings ?? null),
    },
  ]
}

function statementRows(periods: readonly BalanceSheetPeriod[]): StatementTableRow[] {
  const crore = (value: Reported<number>) => formatCrore(value)
  return [
    { key: 'equity-capital', label: 'Equity Capital', values: periods.map((p) => p.equityCapital), format: crore },
    { key: 'reserves', label: 'Reserves', values: periods.map((p) => p.reserves), format: crore },
    { key: 'borrowings', label: 'Borrowings', values: periods.map((p) => p.borrowings), format: crore },
    { key: 'other-liabilities', label: 'Other Liabilities', values: periods.map((p) => p.otherLiabilities), format: crore },
    {
      key: 'total-liabilities',
      label: 'Total Liabilities',
      values: periods.map((p) => p.totalLiabilities),
      format: crore,
      emphasis: true,
    },
    { key: 'fixed-assets', label: 'Fixed Assets', values: periods.map((p) => p.fixedAssets), format: crore },
    // CWIP is null for lenders (HDFC Bank). `formatCrore` renders that as "—",
    // never 0 — the line was not reported, not reported as nothing.
    { key: 'cwip', label: 'CWIP', values: periods.map((p) => p.cwip), format: crore },
    { key: 'investments', label: 'Investments', values: periods.map((p) => p.investments), format: crore },
    { key: 'other-assets', label: 'Other Assets', values: periods.map((p) => p.otherAssets), format: crore },
    {
      key: 'total-assets',
      label: 'Total Assets',
      values: periods.map((p) => p.totalAssets),
      format: crore,
      emphasis: true,
    },
  ]
}

/**
 * The Balance Sheet sub-tab, rendered from the real schema.
 *
 * The balance sheet exists at annual cadence only for these companies, so the
 * panel always reads the **annual** set — the quarterly toggle switches the
 * annual-only notice on, it never switches the figures to (absent) quarterly
 * data. Deltas are therefore always year-on-year.
 */
export function BalanceSheetPanel({ company, period }: BalanceSheetPanelProps) {
  const financials = getCompanyFinancials(company.id)

  if (!financials) {
    return (
      <WidgetGrid>
        <WidgetCard title="Balance sheet" subtitle={company.name}>
          <WidgetEmptyState
            message="No financials for this company"
            hint="Nothing has been ingested for it yet."
          />
        </WidgetCard>
      </WidgetGrid>
    )
  }

  const annual = financials.annual
  const basis = basisLabel(financials.source.basis)
  const scope = 'Last 5 financial years'
  const annualOnly = period === 'quarters'

  // Reuse the source's own reason for the notice, so its wording tracks the data.
  const quarterlyNote =
    financials.quarterly.balanceSheet.status === 'unavailable'
      ? financials.quarterly.balanceSheet.note
      : undefined

  const balanceSheetPeriods = periodsOf(annual.balanceSheet)
  const periodRefs = balanceSheetPeriods.map((entry) => entry.period)
  const hasData = annual.balanceSheet.status === 'available' && balanceSheetPeriods.length > 0
  const stats = hasData ? headlineStats(balanceSheetPeriods) : null

  const unavailableHint =
    annual.balanceSheet.status === 'unavailable'
      ? (annual.balanceSheet.note ?? 'The source does not report it at this cadence.')
      : 'No periods have been ingested yet.'

  return (
    <>
      {annualOnly && <AnnualOnlyNotice statement="Balance sheet" note={quarterlyNote} />}

      <WidgetGrid>
        <WidgetCard title="Position" subtitle={`${scope} · ₹ crore`} badge={basis}>
          {stats ? (
            <StatList stats={stats} />
          ) : (
            <WidgetEmptyState message="Balance sheet not available" hint={unavailableHint} />
          )}
        </WidgetCard>

        <WidgetCard title="Funding composition" subtitle={`${scope} · ₹ crore`} wide>
          {hasData ? (
            <BalanceSheetCompositionChart periods={balanceSheetPeriods} />
          ) : (
            <WidgetEmptyState message="Nothing to plot" hint={unavailableHint} />
          )}
        </WidgetCard>

        <WidgetCard
          title="Balance sheet statement"
          subtitle={`${scope} · ₹ crore`}
          badge={basis}
          footnote={sourceFootnote(basis, financials.source)}
          wide
        >
          {hasData ? (
            <StatementTable
              caption={`${company.name} balance sheet, ${scope.toLowerCase()}, ${basis.toLowerCase()} basis, ₹ crore`}
              periods={periodRefs}
              rows={statementRows(balanceSheetPeriods)}
            />
          ) : (
            <WidgetEmptyState message="Statement not available" hint={unavailableHint} />
          )}
        </WidgetCard>
      </WidgetGrid>
    </>
  )
}
