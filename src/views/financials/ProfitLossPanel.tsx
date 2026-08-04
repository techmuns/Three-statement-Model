import type { PeriodViewId } from '@/config/navigation'
import { RevenueMarginChart } from '@/components/charts/RevenueMarginChart'
import { SegmentMixChart } from '@/components/charts/SegmentMixChart'
import { StatementTable, type StatementTableRow } from '@/components/widgets/StatementTable'
import { StatList, type StatTileProps } from '@/components/widgets/StatTile'
import { WidgetCard } from '@/components/widgets/WidgetCard'
import { WidgetEmptyState } from '@/components/widgets/WidgetEmptyState'
import { WidgetGrid } from '@/components/widgets/WidgetGrid'
import {
  formatBasisPoints,
  formatCrore,
  formatPercent,
  formatRupees,
  formatSignedPercent,
  percentChange,
} from '@/lib/format'
import { sourceFootnote } from '@/lib/provenance'
import { basisLabel, profitLossLabels, type ProfitLossLabels } from '@/lib/statementLabels'
import { statementSetFor } from '@/lib/statements'
import type { MockCompany } from '@/mocks/companies'
import { getCompanyFinancials } from '@/mocks/financials'
import type { Reported } from '@/types/common'
import { periodsOf, type ProfitLossPeriod } from '@/types/financials'

export interface ProfitLossPanelProps {
  company: MockCompany
  period: PeriodViewId
}

function changeSuffix(period: PeriodViewId): string {
  return period === 'quarters' ? 'QoQ' : 'YoY'
}

function tone(value: Reported<number>): 'good' | 'critical' | 'neutral' {
  if (value === null) return 'neutral'
  if (value > 0) return 'good'
  if (value < 0) return 'critical'
  return 'neutral'
}

function headlineStats(
  periods: readonly ProfitLossPeriod[],
  period: PeriodViewId,
  labels: ProfitLossLabels,
): { revenue: StatTileProps[]; profitability: StatTileProps[] } {
  const latest = periods[periods.length - 1]
  const previous = periods.length > 1 ? periods[periods.length - 2] : null
  const suffix = changeSuffix(period)

  const salesChange = percentChange(latest.sales, previous?.sales ?? null)
  const operatingProfitChange = percentChange(
    latest.operatingProfit,
    previous?.operatingProfit ?? null,
  )
  const otherIncomeChange = percentChange(latest.otherIncome, previous?.otherIncome ?? null)
  const marginChange = previous === null ? null : latest.opmPercent - previous.opmPercent
  const netProfitChange = percentChange(latest.netProfit, previous?.netProfit ?? null)

  return {
    revenue: [
      {
        label: `${labels.sales} — ${latest.period.label}`,
        value: formatCrore(latest.sales),
        delta:
          salesChange === null
            ? undefined
            : { label: `${formatSignedPercent(salesChange)} ${suffix}`, tone: tone(salesChange) },
      },
      {
        label: labels.operatingProfit,
        value: formatCrore(latest.operatingProfit),
        delta:
          operatingProfitChange === null
            ? undefined
            : {
                label: `${formatSignedPercent(operatingProfitChange)} ${suffix}`,
                tone: tone(operatingProfitChange),
              },
      },
      {
        label: labels.otherIncome,
        value: formatCrore(latest.otherIncome),
        delta:
          otherIncomeChange === null
            ? undefined
            : {
                label: `${formatSignedPercent(otherIncomeChange)} ${suffix}`,
                tone: tone(otherIncomeChange),
              },
      },
    ],
    profitability: [
      {
        label: labels.opmShort,
        value: formatPercent(latest.opmPercent),
        delta:
          marginChange === null
            ? undefined
            : { label: `${formatBasisPoints(marginChange)} ${suffix}`, tone: tone(marginChange) },
      },
      {
        label: labels.netProfit,
        value: formatCrore(latest.netProfit),
        delta:
          netProfitChange === null
            ? undefined
            : {
                label: `${formatSignedPercent(netProfitChange)} ${suffix}`,
                tone: tone(netProfitChange),
              },
      },
      { label: labels.eps, value: formatRupees(latest.eps) },
    ],
  }
}

function statementRows(
  periods: readonly ProfitLossPeriod[],
  labels: ProfitLossLabels,
): StatementTableRow[] {
  const crore = (value: Reported<number>) => formatCrore(value)
  const percent = (value: Reported<number>) => formatPercent(value)
  const rupees = (value: Reported<number>) => formatRupees(value)

  const interestRow: StatementTableRow = {
    key: 'interest',
    label: labels.interest,
    values: periods.map((p) => p.interest),
    format: crore,
  }

  return [
    { key: 'sales', label: labels.sales, values: periods.map((p) => p.sales), format: crore },
    {
      key: 'expenses',
      label: labels.expenses,
      values: periods.map((p) => p.expenses),
      format: crore,
    },
    // On a lender's layout interest is a cost of revenue, so it sits above the
    // operating-profit line and the column adds up as read.
    ...(labels.interestAboveOperatingProfit ? [interestRow] : []),
    {
      key: 'operating-profit',
      label: labels.operatingProfit,
      values: periods.map((p) => p.operatingProfit),
      format: crore,
      emphasis: true,
    },
    {
      key: 'opm',
      label: labels.opmPercent,
      values: periods.map((p) => p.opmPercent),
      format: percent,
    },
    {
      key: 'other-income',
      label: labels.otherIncome,
      values: periods.map((p) => p.otherIncome),
      format: crore,
    },
    ...(labels.interestAboveOperatingProfit ? [] : [interestRow]),
    {
      key: 'depreciation',
      label: labels.depreciation,
      values: periods.map((p) => p.depreciation),
      format: crore,
    },
    {
      key: 'pbt',
      label: labels.profitBeforeTax,
      values: periods.map((p) => p.profitBeforeTax),
      format: crore,
      emphasis: true,
    },
    {
      key: 'tax',
      label: labels.taxPercent,
      values: periods.map((p) => p.taxPercent),
      format: percent,
    },
    {
      key: 'net-profit',
      label: labels.netProfit,
      values: periods.map((p) => p.netProfit),
      format: crore,
      emphasis: true,
    },
    { key: 'eps', label: labels.eps, values: periods.map((p) => p.eps), format: rupees },
  ]
}

/**
 * The P&L sub-tab, rendered from the real schema.
 *
 * Reads `getCompanyFinancials` for the selected company and picks the statement
 * set the period toggle selects, so changing either control re-renders real
 * figures. Row and series labels come from the company's `statementLayout`.
 * Cards fall back to an honest empty state when a statement isn't available at
 * the selected cadence.
 */
export function ProfitLossPanel({ company, period }: ProfitLossPanelProps) {
  const financials = getCompanyFinancials(company.id)

  if (!financials) {
    return (
      <WidgetGrid>
        <WidgetCard title="Profit & loss" subtitle={company.name}>
          <WidgetEmptyState
            message="No financials for this company"
            hint="Nothing has been ingested for it yet."
          />
        </WidgetCard>
      </WidgetGrid>
    )
  }

  const set = statementSetFor(financials, period)
  const labels = profitLossLabels(financials.statementLayout)
  const basis = basisLabel(financials.source.basis)
  const scope = period === 'quarters' ? 'Last 5 quarters' : 'Last 5 financial years'

  const profitLossPeriods = periodsOf(set.profitLoss)
  const periodRefs = profitLossPeriods.map((entry) => entry.period)
  const hasProfitLoss = set.profitLoss.status === 'available' && profitLossPeriods.length > 0
  const stats = hasProfitLoss ? headlineStats(profitLossPeriods, period, labels) : null

  const unavailableHint =
    set.profitLoss.status === 'unavailable'
      ? (set.profitLoss.note ?? 'The source does not report it at this cadence.')
      : 'No periods have been ingested yet.'

  return (
    <WidgetGrid>
      <WidgetCard title={labels.salesShort} subtitle={`${scope} · ₹ crore`} badge={basis}>
        {stats ? (
          <StatList stats={stats.revenue} />
        ) : (
          <WidgetEmptyState message={`${labels.sales} not available`} hint={unavailableHint} />
        )}
      </WidgetCard>

      <WidgetCard title="Profitability" subtitle={`${scope} · margin profile`}>
        {stats ? (
          <StatList stats={stats.profitability} />
        ) : (
          <WidgetEmptyState
            message="Profitability not available"
            hint="The P&L has not been ingested for this cadence."
          />
        )}
      </WidgetCard>

      {/* Short cards first, then the two wide ones. Grid rows stretch to their
          tallest card, so mixing a tall chart into a row of stat tiles would
          leave the tiles mostly empty. */}
      <WidgetCard
        title="Segment revenue mix"
        subtitle={`${scope} · share of ${labels.salesShort.toLowerCase()}`}
      >
        {set.segmentMix.status === 'available' ? (
          <SegmentMixChart segments={set.segmentMix.segments} periods={periodRefs} />
        ) : (
          // The union's unavailable branch carries the reason, so the card can
          // say why the data is missing instead of implying there is none.
          <WidgetEmptyState
            message={
              period === 'quarters'
                ? "Segment mix isn't available at quarterly cadence"
                : 'Segment mix not available'
            }
            hint={set.segmentMix.note ?? 'The source does not publish it for this period.'}
          />
        )}
      </WidgetCard>

      <WidgetCard
        title={`${labels.salesShort} & margin trend`}
        subtitle={`${scope} · ${basis}`}
        footnote={labels.operatingProfitNote}
        wide
      >
        {hasProfitLoss ? (
          <RevenueMarginChart periods={profitLossPeriods} labels={labels} />
        ) : (
          <WidgetEmptyState
            message="No trend to plot"
            hint="The P&L has not been ingested for this cadence."
          />
        )}
      </WidgetCard>

      <WidgetCard
        title="Profit & loss statement"
        subtitle={`${scope} · ₹ crore unless stated`}
        badge={basis}
        footnote={sourceFootnote(basis, financials.source)}
        wide
      >
        {hasProfitLoss ? (
          <StatementTable
            caption={`${company.name} profit and loss statement, ${scope.toLowerCase()}, ${basis.toLowerCase()} basis, ₹ crore unless stated`}
            periods={periodRefs}
            rows={statementRows(profitLossPeriods, labels)}
          />
        ) : (
          <WidgetEmptyState message="Statement not available" hint={unavailableHint} />
        )}
      </WidgetCard>
    </WidgetGrid>
  )
}
