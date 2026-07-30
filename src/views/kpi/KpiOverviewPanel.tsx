import type { ReactNode } from 'react'
import { findKpiDefinition } from '@/config/kpis'
import { KpiStatTile } from '@/components/widgets/KpiStatTile'
import { PeerComparisonTable } from '@/components/widgets/PeerComparisonTable'
import { WidgetCard } from '@/components/widgets/WidgetCard'
import { WidgetEmptyState } from '@/components/widgets/WidgetEmptyState'
import { WidgetGrid } from '@/components/widgets/WidgetGrid'
import { WidgetSkeleton } from '@/components/widgets/WidgetSkeleton'
import type { WidgetState } from '@/components/widgets/widgetState'
import type { MockCompany } from '@/mocks/companies'
import { getCompanyKpis, getPeerComparison } from '@/mocks/kpis'
import { getPeerGroupForCompany } from '@/mocks/peers'
import { findKpiValue, type KpiId } from '@/types/kpi'

export interface KpiOverviewPanelProps {
  company: MockCompany
  /** Drives the shared preview-state control in the toolbar. */
  state: WidgetState
}

/** Every card in this panel shares one empty message when the toggle forces it. */
const PREVIEW_EMPTY = {
  message: 'Nothing to show yet',
  hint: 'The preview control above is set to the empty state.',
}

/**
 * The six standard KPIs, split into the two lenses an analyst reads them
 * through: how fast the business is growing and how profitable it is (all P&L
 * ratios), versus how well it turns capital into returns and how leveraged it
 * is to do so (the balance-sheet ratios). There is no valuation multiple in the
 * schema, so there is no valuation group.
 */
const KPI_GROUPS: readonly { title: string; ids: readonly KpiId[] }[] = [
  { title: 'Growth & margins', ids: ['revenue-growth', 'operating-margin', 'net-profit-margin'] },
  {
    title: 'Returns & leverage',
    ids: ['return-on-equity', 'return-on-capital-employed', 'debt-to-equity'],
  },
]

/**
 * The KPI Overview tab, rendered from the real schema.
 *
 * Reads `getCompanyKpis` for the selected company, so switching companies
 * re-renders real figures. Each KPI shows its value, where it sits against the
 * peer set, and its trend; the peer comparison table puts the subject beside
 * its tracked siblings and carried peers.
 */
export function KpiOverviewPanel({ company, state }: KpiOverviewPanelProps) {
  const kpis = getCompanyKpis(company.id)

  if (!kpis) {
    return (
      <WidgetGrid>
        <WidgetCard title="KPI overview" subtitle={company.name}>
          <WidgetEmptyState
            message="No KPIs for this company"
            hint="Nothing has been ingested for it yet."
          />
        </WidgetCard>
      </WidgetGrid>
    )
  }

  const group = getPeerGroupForCompany(company.id)
  const peerRows = getPeerComparison(company.id)
  const asOf = kpis.asOfPeriodId
  const peerContext = group ? `vs ${group.label}` : 'no peer cohort'
  const loading = state === 'loading'
  const forcedEmpty = state === 'empty'

  /** Wraps a card body in the loading and forced-empty states. */
  const body = (content: ReactNode, skeletonRows = 3): ReactNode => {
    if (loading) return <WidgetSkeleton rows={skeletonRows} />
    if (forcedEmpty) return <WidgetEmptyState {...PREVIEW_EMPTY} />
    return content
  }

  return (
    <WidgetGrid>
      {KPI_GROUPS.map((groupDef) => (
        <WidgetCard key={groupDef.title} title={groupDef.title} subtitle={`${asOf} · ${peerContext}`}>
          {body(
            <div className="flex flex-col gap-5">
              {groupDef.ids.map((id) => {
                const value = findKpiValue(kpis, id)
                const definition = findKpiDefinition(id)
                return value ? (
                  <KpiStatTile key={id} definition={definition} value={value} />
                ) : (
                  <div key={id}>
                    <p className="text-caption font-medium text-ink-muted">{definition.label}</p>
                    <p className="mt-1 text-stat font-semibold text-ink-subtle">—</p>
                  </div>
                )
              })}
            </div>,
          )}
        </WidgetCard>
      ))}

      <WidgetCard
        title="Peer comparison"
        subtitle={group ? `${group.label} · ${asOf}` : asOf}
        footnote="Tracked rows are derived from full statements and can be drilled into; carried rows show peers' headline sector-screen values only."
        wide
      >
        {loading ? (
          <WidgetSkeleton rows={5} label="Loading peer comparison" />
        ) : forcedEmpty ? (
          <WidgetEmptyState {...PREVIEW_EMPTY} />
        ) : peerRows.length > 0 ? (
          <PeerComparisonTable
            rows={peerRows}
            caption={`${company.name} versus ${group?.label ?? 'peer'} companies across the six standard KPIs, ${asOf}`}
          />
        ) : (
          <WidgetEmptyState
            message="No peer set"
            hint="This company has no sector cohort to compare against."
          />
        )}
      </WidgetCard>
    </WidgetGrid>
  )
}
