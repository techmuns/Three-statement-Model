import { PageToolbar } from '@/components/layout/PageToolbar'
import { PeerComparisonTable } from '@/components/widgets/PeerComparisonTable'
import { WidgetCard } from '@/components/widgets/WidgetCard'
import { WidgetEmptyState } from '@/components/widgets/WidgetEmptyState'
import { WidgetGrid } from '@/components/widgets/WidgetGrid'
import type { MockCompany } from '@/mocks/companies'
import { getCompanyKpis, getPeerComparison } from '@/mocks/kpis'
import { getPeerGroupForCompany } from '@/mocks/peers'

export interface PeerComparisonViewProps {
  company: MockCompany
}

/**
 * The Peer Comparison tab — the full comparison table, moved here from the old
 * KPI Overview. This tab's redesign is a separate phase; for now it preserves
 * the existing table (subject beside its tracked siblings and carried peers)
 * unchanged.
 */
export function PeerComparisonView({ company }: PeerComparisonViewProps) {
  const kpis = getCompanyKpis(company.id)
  const group = getPeerGroupForCompany(company.id)
  const peerRows = getPeerComparison(company.id)
  const asOf = kpis?.asOfPeriodId ?? ''

  return (
    <>
      <PageToolbar
        title={`${company.name} · Peer Comparison`}
        description={`${company.ticker} · ${company.sector}`}
      />

      <WidgetGrid>
        <WidgetCard
          title="Peer comparison"
          subtitle={group ? `${group.label} · ${asOf}` : company.sector}
          footnote="Tracked rows are derived from full statements and can be drilled into; carried rows show peers' headline sector-screen values only."
          wide
        >
          {peerRows.length > 0 ? (
            <PeerComparisonTable
              rows={peerRows}
              caption={`${company.name} versus ${group?.label ?? 'peer'} companies across the six standard KPIs, ${asOf}`}
            />
          ) : (
            <WidgetEmptyState
              message="No peer set"
              hint="This company has no sector cohort to compare against yet."
            />
          )}
        </WidgetCard>
      </WidgetGrid>
    </>
  )
}
