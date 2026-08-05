import type { PeriodViewId } from '@/config/navigation'
import { KPI_IDS, findKpiDefinition } from '@/config/kpis'
import { RevenueMarginChart } from '@/components/charts/RevenueMarginChart'
import { SegmentMixChart } from '@/components/charts/SegmentMixChart'
import { AnalystView } from '@/components/overview/AnalystView'
import { HistoricalTable } from '@/components/overview/HistoricalTable'
import { KpiScorecard } from '@/components/overview/KpiScorecard'
import { PeerPositioning } from '@/components/overview/PeerPositioning'
import { AnnualOnlyNotice } from '@/components/widgets/AnnualOnlyNotice'
import { WidgetCard } from '@/components/widgets/WidgetCard'
import { WidgetEmptyState } from '@/components/widgets/WidgetEmptyState'
import { WidgetGrid } from '@/components/widgets/WidgetGrid'
import { buildAnalystSummary } from '@/lib/analystSummary'
import { basisLabel, profitLossLabels } from '@/lib/statementLabels'
import { statementSetFor } from '@/lib/statements'
import type { MockCompany } from '@/mocks/companies'
import { getCompanyFinancials } from '@/mocks/financials'
import { getCompanyKpiHistory, getCompanyKpis } from '@/mocks/kpis'
import { getSectorPeerPositioning } from '@/mocks/sectorPeers'
import { periodsOf } from '@/types/financials'
import { findKpiValue } from '@/types/kpi'

export interface OverviewViewProps {
  company: MockCompany
  period: PeriodViewId
}

/**
 * The Overview tab: six KPI scorecards, the revenue/margin trend beside the
 * segment mix, peer positioning against real sector peers, a templated analyst
 * view, and a self-comparison table.
 *
 * KPIs are annual — three of the six (ROE, ROCE, Debt/Equity) need the balance
 * sheet, which Indian filers publish only annually — so the scorecards, peer
 * positioning and history are annual regardless of the header's period toggle.
 * The toggle drives the trend and segment sections, which are P&L-based and do
 * exist quarterly.
 */
export function OverviewView({ company, period }: OverviewViewProps) {
  const financials = getCompanyFinancials(company.id)
  const kpis = getCompanyKpis(company.id)

  if (!financials || !kpis) {
    return (
      <WidgetGrid>
        <WidgetCard title="Overview" subtitle={company.name}>
          <WidgetEmptyState
            message="Awaiting data"
            hint={`${company.name} hasn't been scraped yet — its overview appears once the scraper has run for it.`}
          />
        </WidgetCard>
      </WidgetGrid>
    )
  }

  const history = getCompanyKpiHistory(company.id)
  const positioning = getSectorPeerPositioning(company.id)
  const summary = buildAnalystSummary(history, positioning)
  const asOf = kpis.asOfPeriodId

  const peerStatByKpi = new Map(
    positioning?.hasEnough ? positioning.stats.map((stat) => [stat.kpiId, stat]) : [],
  )
  const historyStatByKpi = new Map((history?.stats ?? []).map((stat) => [stat.kpiId, stat]))

  // Trend + segment respond to the period toggle.
  const set = statementSetFor(financials, period)
  const labels = profitLossLabels(financials.statementLayout)
  const basis = basisLabel(financials.source.basis)
  const scope = period === 'quarters' ? 'Last 5 quarters' : 'Last 5 years'
  const profitLossPeriods = periodsOf(set.profitLoss)
  const hasProfitLoss = set.profitLoss.status === 'available' && profitLossPeriods.length > 0
  const periodRefs = profitLossPeriods.map((entry) => entry.period)

  const annualSegment = financials.annual.segmentMix
  const showQuarterlyFallback =
    period === 'quarters' && set.segmentMix.status !== 'available' && annualSegment.status === 'available'
  const annualPeriodRefs = periodsOf(financials.annual.profitLoss).map((entry) => entry.period)

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Key metrics">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="text-heading font-bold tracking-tight text-ink-primary">Key metrics</h2>
          <p className="text-caption text-ink-muted">Annual · as of {asOf}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {KPI_IDS.map((id) => {
            const value = findKpiValue(kpis, id)
            if (!value) return null
            return (
              <KpiScorecard
                key={id}
                definition={findKpiDefinition(id)}
                value={value}
                peerStat={peerStatByKpi.get(id) ?? null}
                historyStat={historyStatByKpi.get(id) ?? null}
              />
            )
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.85fr_1fr]">
        <WidgetCard title="Revenue & profitability trend" subtitle={`${scope} · ${basis}`}>
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
          title="Segment mix"
          subtitle={`${scope} · share of ${labels.salesShort.toLowerCase()}`}
        >
          {set.segmentMix.status === 'available' ? (
            <SegmentMixChart segments={set.segmentMix.segments} periods={periodRefs} />
          ) : showQuarterlyFallback && annualSegment.status === 'available' ? (
            <>
              <AnnualOnlyNotice statement="Segment mix" />
              <SegmentMixChart segments={annualSegment.segments} periods={annualPeriodRefs} />
            </>
          ) : (
            <WidgetEmptyState
              message="Segment mix not available"
              hint={
                set.segmentMix.note ??
                'Segment revenue is a separate disclosure, not on the Screener company page.'
              }
            />
          )}
        </WidgetCard>
      </div>

      <PeerPositioning company={company} asOf={asOf} positioning={positioning} />
      <AnalystView summary={summary} />
      {history && <HistoricalTable history={history} />}
    </div>
  )
}
