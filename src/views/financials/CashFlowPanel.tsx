import type { PeriodViewId } from '@/config/navigation'
import { CashFlowActivityChart } from '@/components/charts/CashFlowActivityChart'
import { AnnualOnlyNotice } from '@/components/widgets/AnnualOnlyNotice'
import { StatementTable, type StatementTableRow } from '@/components/widgets/StatementTable'
import { StatList, type StatTileProps } from '@/components/widgets/StatTile'
import { WidgetCard } from '@/components/widgets/WidgetCard'
import { WidgetEmptyState } from '@/components/widgets/WidgetEmptyState'
import { WidgetGrid } from '@/components/widgets/WidgetGrid'
import { formatCrore, formatSignedCrore } from '@/lib/format'
import { sourceFootnote } from '@/lib/provenance'
import { basisLabel } from '@/lib/statementLabels'
import type { MockCompany } from '@/mocks/companies'
import { getCompanyFinancials } from '@/mocks/financials'
import type { Reported } from '@/types/common'
import { periodsOf, type CashFlowPeriod } from '@/types/financials'

export interface CashFlowPanelProps {
  company: MockCompany
  period: PeriodViewId
}

/**
 * The YoY delta on a cash flow line is an **absolute** ₹ crore change, not a
 * percentage: these lines are routinely negative and can cross zero, so a
 * percentage change would be nonsense (a −3,840 → +6,280 swing is not "−264%").
 * Neutral tone because more or less cash from an activity is not per se good or
 * bad — direction is carried by the arrow and sign.
 */
function yoyDelta(current: number, previous: Reported<number>): StatTileProps['delta'] {
  if (previous === null) return undefined
  return { label: `${formatSignedCrore(current - previous)} YoY`, tone: 'neutral' }
}

function headlineStats(periods: readonly CashFlowPeriod[]): StatTileProps[] {
  const latest = periods[periods.length - 1]
  const previous = periods.length > 1 ? periods[periods.length - 2] : null
  return [
    {
      label: `Operating (CFO) — ${latest.period.label}`,
      value: formatCrore(latest.cashFromOperating),
      delta: yoyDelta(latest.cashFromOperating, previous?.cashFromOperating ?? null),
    },
    {
      label: 'Investing (CFI)',
      value: formatCrore(latest.cashFromInvesting),
      delta: yoyDelta(latest.cashFromInvesting, previous?.cashFromInvesting ?? null),
    },
    {
      label: 'Financing (CFF)',
      value: formatCrore(latest.cashFromFinancing),
      delta: yoyDelta(latest.cashFromFinancing, previous?.cashFromFinancing ?? null),
    },
    {
      label: 'Net Cash Flow',
      value: formatCrore(latest.netCashFlow),
      delta: yoyDelta(latest.netCashFlow, previous?.netCashFlow ?? null),
    },
  ]
}

function statementRows(periods: readonly CashFlowPeriod[]): StatementTableRow[] {
  const crore = (value: Reported<number>) => formatCrore(value)
  return [
    {
      key: 'cfo',
      label: 'Cash from Operating Activity',
      values: periods.map((p) => p.cashFromOperating),
      format: crore,
    },
    // Broken out beneath CFO, of which it is one component. Nullable on the
    // source's condensed view, so it renders "—" where absent, never 0.
    {
      key: 'working-capital',
      label: 'of which: working-capital change',
      values: periods.map((p) => p.workingCapitalChange),
      format: crore,
    },
    {
      key: 'cfi',
      label: 'Cash from Investing Activity',
      values: periods.map((p) => p.cashFromInvesting),
      format: crore,
    },
    {
      key: 'cff',
      label: 'Cash from Financing Activity',
      values: periods.map((p) => p.cashFromFinancing),
      format: crore,
    },
    {
      key: 'net',
      label: 'Net Cash Flow',
      values: periods.map((p) => p.netCashFlow),
      format: crore,
      emphasis: true,
    },
  ]
}

/**
 * The Cash Flow sub-tab, rendered from the real schema.
 *
 * Like the balance sheet, the cash flow statement exists at annual cadence only
 * for these companies, so the panel always reads the **annual** set and the
 * quarterly toggle only switches the annual-only notice on. Deltas are always
 * year-on-year, and in absolute ₹ crore rather than percent because the lines
 * can be negative.
 */
export function CashFlowPanel({ company, period }: CashFlowPanelProps) {
  const financials = getCompanyFinancials(company.id)

  if (!financials) {
    return (
      <WidgetGrid>
        <WidgetCard title="Cash flow" subtitle={company.name}>
          <WidgetEmptyState
            message="Awaiting data"
            hint={`${company.name} hasn't been scraped yet — figures appear here once the scraper has run for it.`}
          />
        </WidgetCard>
      </WidgetGrid>
    )
  }

  const annual = financials.annual
  const basis = basisLabel(financials.source.basis)
  const scope = 'Last 5 financial years'
  const annualOnly = period === 'quarters'

  const quarterlyNote =
    financials.quarterly.cashFlow.status === 'unavailable'
      ? financials.quarterly.cashFlow.note
      : undefined

  const cashFlowPeriods = periodsOf(annual.cashFlow)
  const periodRefs = cashFlowPeriods.map((entry) => entry.period)
  const hasData = annual.cashFlow.status === 'available' && cashFlowPeriods.length > 0
  const stats = hasData ? headlineStats(cashFlowPeriods) : null

  const unavailableHint =
    annual.cashFlow.status === 'unavailable'
      ? (annual.cashFlow.note ?? 'The source does not report it at this cadence.')
      : 'No periods have been ingested yet.'

  return (
    <>
      {annualOnly && <AnnualOnlyNotice statement="Cash flow" note={quarterlyNote} />}

      <WidgetGrid>
        <WidgetCard title="Cash flows" subtitle={`${scope} · ₹ crore`} badge={basis}>
          {stats ? (
            <StatList stats={stats} />
          ) : (
            <WidgetEmptyState message="Cash flow not available" hint={unavailableHint} />
          )}
        </WidgetCard>

        <WidgetCard title="Cash flow by activity" subtitle={`${scope} · ₹ crore`} wide>
          {hasData ? (
            <CashFlowActivityChart periods={cashFlowPeriods} />
          ) : (
            <WidgetEmptyState message="Nothing to plot" hint={unavailableHint} />
          )}
        </WidgetCard>

        <WidgetCard
          title="Cash flow statement"
          subtitle={`${scope} · ₹ crore`}
          badge={basis}
          footnote={sourceFootnote(basis, financials.source)}
          wide
        >
          {hasData ? (
            <StatementTable
              caption={`${company.name} cash flow statement, ${scope.toLowerCase()}, ${basis.toLowerCase()} basis, ₹ crore`}
              periods={periodRefs}
              rows={statementRows(cashFlowPeriods)}
            />
          ) : (
            <WidgetEmptyState message="Statement not available" hint={unavailableHint} />
          )}
        </WidgetCard>
      </WidgetGrid>
    </>
  )
}
