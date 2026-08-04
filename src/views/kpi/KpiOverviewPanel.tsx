import { findKpiDefinition } from '@/config/kpis'
import { KpiStatTile } from '@/components/widgets/KpiStatTile'
import { PeerComparisonTable } from '@/components/widgets/PeerComparisonTable'
import { WidgetCard } from '@/components/widgets/WidgetCard'
import { WidgetEmptyState } from '@/components/widgets/WidgetEmptyState'
import { WidgetGrid } from '@/components/widgets/WidgetGrid'
import type { MockCompany } from '@/mocks/companies'
import { getCompanyKpis, getPeerComparison } from '@/mocks/kpis'
import { getPeerGroupForCompany } from '@/mocks/peers'
import { findKpiValue, type KpiId } from '@/types/kpi'

export interface KpiOverviewPanelProps {
  company: MockCompany
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
export function KpiOverviewPanel({ company }: KpiOverviewPanelProps) {
  const kpis = getCompanyKpis(company.id)

  if (!kpis) {
    return (
      <WidgetGrid>
        <WidgetCard title="KPI overview" subtitle={company.name}>
          <WidgetEmptyState
            message="Awaiting data"
            hint={`${company.name} hasn't been scraped yet — KPIs appear here once its statements have been scraped.`}
          />
        </WidgetCard>
      </WidgetGrid>
    )
  }

  const group = getPeerGroupForCompany(company.id)
  const peerRows = getPeerComparison(company.id)
  const asOf = kpis.asOfPeriodId
  const peerContext = group ? `vs ${group.label}` : 'no peer cohort'

  return (
    <WidgetGrid>
      {KPI_GROUPS.map((groupDef) => (
        <WidgetCard key={groupDef.title} title={groupDef.title} subtitle={`${asOf} · ${peerContext}`}>
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
          </div>
        </WidgetCard>
      ))}

      <WidgetCard
        title="Peer comparison"
        subtitle={group ? `${group.label} · ${asOf}` : asOf}
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
            hint="This company has no sector cohort to compare against."
          />
        )}
      </WidgetCard>
    </WidgetGrid>
  )
}
